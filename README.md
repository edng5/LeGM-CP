
# LeGM-CP: Fantasy Basketball MCP

## Overview
LeGM-CP is a Fantasy Basketball Management Copilot Project (MCP) that helps users manage their fantasy basketball teams. It provides tools to fetch player statistics, access league rules, and retrieve resources such as PDF cheat sheets. The chatbot client now supports conversation context retention for more natural, multi-turn interactions.

## Project Structure
```
LeGM-CP/
├── client.py                # Chatbot client with context retention
├── server.py                # MCP server exposing tools and resources
├── requirements.txt         # Project dependencies
├── pyproject.toml           # Project metadata
├── prompts/                 # Prompt templates for league rules and strategies
│   ├── league_rules.txt
│   └── MMP_team_building.txt
├── resources/               # PDF and other resource files
│   └── FBA24catCS.pdf
└── README.md                # Project documentation
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   cd LeGM-CP
   ```

2. Install the required dependencies:
   ```
   pip install -r requirements.txt
   ```

3. Run the MCP server:
   ```
   uv run server.py
   ```

4. Run the chatbot client:
   ```
   uv run client.py
   ```

## Features
- **Contextual Chatbot**: The chatbot client now remembers previous conversation turns within a session, allowing for more natural and contextual interactions.
- **Fetch Player Stats**: Use the `fetch_nba_player_stats` tool to retrieve statistics for a specific NBA player.
- **League Rules & Draft Strategy**: Access prompt templates for league rules and team-building strategies.
- **PDF Resource Extraction**: The server exposes a tool to extract and return the text from all PDF files in the `resources/` directory.

## Usage Examples
- **Chatbot**: Start the client and interact with the chatbot. It will remember your previous questions and answers during the session.
- **PDF Resource Tool**: The server's `get_projected_rankings` tool will extract and return the text from all PDFs in the `resources/` folder.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.
