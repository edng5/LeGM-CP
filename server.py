from mcp.server.fastmcp import FastMCP
import httpx
from nba_api.stats.endpoints import playercareerstats
from nba_api.stats.static import players
import asyncio
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("server")

@mcp.tool()
async def fetch_player_stats(player_name: str) -> dict:
    return await fetch_nba_player_stats(player_name)

# @mcp.tool()
# async def select_team(players: list, build_strategy: str) -> list:
#     return select_team_based_on_build(players, build_strategy)

@mcp.tool()
async def league_rules() -> str:
    return get_league_rules_prompt()



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
def get_league_rules_prompt() -> str:
    with open("prompts/league_rules.txt", "r", encoding="utf-8") as f:
        return f.read()

@mcp.prompt()
def get_draft_strategy_prompt() -> str:
    with open("prompts/MMP_team_building.txt", "r", encoding="utf-8") as f:
        return f.read()


if __name__ == "__main__":
    mcp.run(transport="stdio")