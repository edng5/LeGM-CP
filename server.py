
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
import nest_asyncio
import logging
from dotenv import load_dotenv
from anthropic import Anthropic
import re
nest_asyncio.apply()
logging.basicConfig(level=logging.INFO)

load_dotenv()
# --- MCP ChatBot Integration ---
class MCP_ChatBot:
    def __init__(self):
        self.session = None
        self.available_tools = []
        self.conversation_history = []
        self.drafted_players = []  # Persist user's drafted players
        self.current_pick = None   # Persist user's current pick number

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
        # Extract drafted players from query ("I drafted ..." or "My current roster is ...")
        drafted_match = re.search(r'i drafted ([A-Za-z .,\'"-]+)', query.lower())
        roster_match = re.search(r'my current roster is: ([A-Za-z .,\'"-]+)', query.lower())
        drafted_players = []
        if drafted_match:
            drafted_players += [p.strip().title() for p in drafted_match.group(1).split(',')]
        if roster_match:
            drafted_players += [p.strip().title() for p in roster_match.group(1).split(',')]
        # Always persist the full roster
        if drafted_players:
            self.drafted_players = drafted_players
        # Extract explicit pick number from query ("pick 1", "at 1", or "I'm drafting at position ...")
        pick_match = re.search(r'(?:pick|selection|at pick|at)\s*(\d+)', query.lower())
        pos_round_match = re.search(r'i\'?m drafting at position (\d+) in round (\d+)', query.lower())
        if pos_round_match:
            self.current_pick = int(pos_round_match.group(1)) + (int(pos_round_match.group(2)) - 1) * 10
        elif pick_match:
            self.current_pick = int(pick_match.group(1))
        # Add user message to conversation history
        self.conversation_history.append({'role': 'user', 'content': query})
        try:
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
            # Build context string
            context_str = '\n\n'.join(mcp_context)
            # Ask LLM for top 3 recommendations only
            # Try to extract pick context from user query
            # Use persisted pick number and drafted players
            pick_num = self.current_pick
            # If user says "who should I pick next?", estimate next pick based on 10-team serpentine draft
            serpentine_next_pick = None
            if pick_num is not None:
                prev_pick = pick_num
                round_num = ((prev_pick - 1) // 10) + 1
                pos_in_round = ((prev_pick - 1) % 10) + 1
                if round_num % 2 == 1:
                    next_pos = 10 - pos_in_round + 1
                else:
                    next_pos = pos_in_round
                serpentine_next_pick = (round_num * 10) + next_pos
            # If query asks for next pick, use serpentine_next_pick
            if re.search(r'next pick|who should i pick next', query.lower()) and serpentine_next_pick:
                pick_num = serpentine_next_pick
                self.current_pick = pick_num
            # Compose drafted players string
            drafted_str = ', '.join(self.drafted_players) if self.drafted_players else 'None'
            # Ensure pick_num is a number or 'unknown'
            pick_str = str(pick_num) if isinstance(pick_num, int) else 'unknown'
            prompt = (
                f"{context_str}\n\nUser question: {query}\n"
                f"Draft Pick: {pick_str}\n"
                f"Your drafted players: {drafted_str}\n"
                f"Please answer for a 10-team, serpentine draft. Recommend the top 3 players for this pick only.\n"
                "Format your answer exactly as follows:\n"
                "Draft Pick: <The draft pick I should be at>\n"
                "Your drafted players: <player1>, <player2>, ...\n"
                "Recommended players: <player1>, <player2>, <player3>\n\n"
                "<Player1> (TEAM - POS):\nPros - <pros>\nCons - <cons>\n\n"
                "<Player2> (TEAM - POS):\nPros - <pros>\nCons - <cons>\n\n"
                "<Player3> (TEAM - POS):\nPros - <pros>\nCons - <cons>\n\n"
                "STATS: {\"Player1\": {\"PTS\":...,\"TRB\":...,\"AST\":...,\"3P\":...,\"STL\":...,\"BLK\":...,\"FG%\":...,\"FT%\":...,\"TOV\":...}, ...}\n"
                "Do not include any other text or advice. Make sure to include the STATS JSON block in the above format so it can be visualized."
            )
            anthropic_client = Anthropic()
            response = anthropic_client.messages.create(
                max_tokens=700,
                model='claude-3-7-sonnet-20250219',
                messages=[{"role": "user", "content": prompt}]
            )
            answer = ""
            for content in response.content:
                if content.type == 'text':
                    answer += content.text + "\n"
            # Do NOT prepend 'Your team so far:' anymore; rely on LLM output 'Your drafted players:'
            answer = answer
            # Only increment current_pick if a pick was made (i.e., user drafted a player this turn)
            if drafted_match and self.current_pick is not None:
                self.current_pick += 10
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