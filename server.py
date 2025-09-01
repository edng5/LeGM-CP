
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import nest_asyncio
import logging
from dotenv import load_dotenv
nest_asyncio.apply()
logging.basicConfig(level=logging.INFO)

load_dotenv()
# --- MCP ChatBot Integration ---
class MCP_ChatBot:
    def __init__(self):
        self.session = None
        self.available_tools = []
        self.conversation_history = []

    async def connect(self):
        server_params = StdioServerParameters(
            command="uv",
            args=["run", "server.py"],
            env=None,
        )
        self.stdio_client = stdio_client(server_params)
        self._client_context = await self.stdio_client.__aenter__()
        read, write = self._client_context
        self.session = await ClientSession(read, write).__aenter__()
        await self.session.initialize()
        response = await self.session.list_tools()
        tools = response.tools
        print("\nConnected to server with tools:", [tool.name for tool in tools])
        self.available_tools = [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.inputSchema
            }
            for tool in response.tools
        ]

    async def process_query(self, query):
        import logging
        logging.info(f"[MCP_ChatBot] Received query: {query}")
        self.conversation_history.append({'role': 'user', 'content': query})
        try:
            from anthropic import Anthropic
            mcp_context = []
            # Pull from MCP-defined resources
            try:
                rankings = get_projected_rankings()
                mcp_context.append(f"Resources:\n{rankings}")
            except Exception as e:
                mcp_context.append(f"Resources: Error fetching: {str(e)}")
            # Pull from MCP-defined prompts
            try:
                draft_prompt = get_draft_strategy_prompt()
                mcp_context.append(f"Prompts:\n{draft_prompt}")
            except Exception as e:
                mcp_context.append(f"Prompts: Error fetching: {str(e)}")
            # Pull from MCP-defined tools (example: fetch_nba_player_stats for top players)
            # Optionally, you could call fetch_nba_player_stats for top ranked players here
            # Build context string
            context_str = '\n\n'.join(mcp_context)
            # Use the context and user query directly
            prompt = f"{context_str}\n\nUser question: {query}"
            anthropic_client = Anthropic()
            response = anthropic_client.messages.create(
                max_tokens=512,
                model='claude-3-7-sonnet-20250219',
                messages=[{"role": "user", "content": prompt}]
            )
            answer = ""
            for content in response.content:
                if content.type == 'text':
                    answer += content.text + "\n"
            return answer.strip() if answer else "No answer generated."
        except Exception as e:
            logging.error(f"[MCP_ChatBot] Exception: {str(e)}")
            return f"Backend error: {str(e)}"

# --- End MCP ChatBot Integration ---


from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from mcp.server.fastmcp import FastMCP
import httpx
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.static import players
import asyncio
import os
from process_utils.utils_pdf import extract_pdf_text_with_ocr

mcp = FastMCP("server")

# FastAPI app for HTTP endpoint
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


chatbot = MCP_ChatBot()

@app.on_event("startup")
async def startup_event():
    await chatbot.connect()

@app.post("/chat")
async def chat(request: Request):
    import logging
    logging.info("[FastAPI] /chat endpoint called")
    data = await request.json()
    user_message = data.get("message", "")
    logging.info(f"[FastAPI] Received message: {user_message}")
    try:
        response = await chatbot.process_query(user_message)
        logging.info(f"[FastAPI] Response from chatbot: {response}")
        if not response:
            response = "No response generated."
        return {"response": response}
    except Exception as e:
        logging.error(f"[FastAPI] Exception: {str(e)}")
        return {"error": str(e)}

from mcp.server.fastmcp import FastMCP
import httpx
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.static import players
import asyncio
from mcp.server.fastmcp import FastMCP
import os
from process_utils.utils_pdf import extract_pdf_text_with_ocr

mcp = FastMCP("server")

@mcp.resource("resource://resources")
def get_projected_rankings() -> str:
    resources_dir = os.path.join(os.path.dirname(__file__), "resources")
    content = []
    for filename in os.listdir(resources_dir):
        if filename.lower().endswith(".pdf"):
            pdf_path = os.path.join(resources_dir, filename)
            # Use OCR-based extraction for each PDF
            text = extract_pdf_text_with_ocr(pdf_path)
            content.append(f"--- {filename} ---\n{text}\n")
    return "\n".join(content)

@mcp.tool()
async def fetch_player_stats(player_name: str) -> dict:
    return await fetch_nba_player_stats(player_name)

@mcp.tool()
async def draft_strategy() -> str:
    return get_draft_strategy_prompt()


CATEGORIES = ["G", "FG%", "3P", "FT%", "TRB", "AST", "STL", "BLK", "TOV", "PTS"]

@mcp.tool()
async def get_player_id(player_name):
    loop = asyncio.get_event_loop()
    def _find():
        player_dict = players.find_players_by_full_name(player_name)
        if player_dict:
            return player_dict[0]['id']
        return None
    return await loop.run_in_executor(None, _find)

@mcp.tool()
async def fetch_nba_player_stats(player_name):
    loop = asyncio.get_event_loop()
    player_id = await get_player_id(player_name)
    if not player_id:
        print("Player not found.")
        return {}
    def _fetch_stats():
        career = playercareerstats.PlayerCareerStats(player_id=player_id)
        df = career.get_data_frames()[0]
        last_3_seasons = df.tail(3)
        seasons_stats = {}
        for _, row in last_3_seasons.iterrows():
            season = row['SEASON_ID']
            G = row['GP'] if row['GP'] else 1  # Avoid division by zero
            stats = {
                "G": G,
                "FG%": round(row['FG_PCT'], 2),
                "FT%": round(row['FT_PCT'], 2),
                "3P": round(row['FG3M'] / G if G else 0, 2),
                "TRB": round(row['REB'] / G if G else 0, 2),
                "AST": round(row['AST'] / G if G else 0, 2),
                "STL": round(row['STL'] / G if G else 0, 2),
                "BLK": round(row['BLK'] / G if G else 0, 2),
                "TOV": round(row['TOV'] / G if G else 0, 2),
                "PTS": round(row['PTS'] / G if G else 0, 2)
            }
            seasons_stats[season] = stats
        return seasons_stats
    return await loop.run_in_executor(None, _fetch_stats)

@mcp.prompt()
def get_draft_strategy_prompt() -> str:
    output = ""
    with open("prompts/MMP_team_building.txt", "r", encoding="utf-8") as f:
        output += f.read() + "\n"
    
    with open("prompts/league_rules.txt", "r", encoding="utf-8") as f:
        output += f.read()

    return output


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "api":
        uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
    else:
        mcp.run(transport="stdio")