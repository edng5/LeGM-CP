# Fantasy Basketball MCP

## Overview
Fantasy Basketball MCP is a project designed to assist users in managing their fantasy basketball teams. It provides tools to fetch player statistics, select players based on specific build strategies, and define league rules.

## Project Structure
```
LeGM-CP
├── src
│   ├── server.py                # Main entry point of the application
│   ├── tools
│   │   ├── fetch_player_stats.py # Tool to fetch NBA player statistics
│   │   ├── select_team.py        # Tool to select players based on build strategies
│   │   └── prompt_templates.py    # Tool to define league rules prompt templates
│   └── types
│       └── index.py              # Type definitions and interfaces
├── requirements.txt              # Project dependencies
└── README.md                     # Project documentation
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

3. Run the server:
   ```
   python src/server.py
   ```

## Usage Examples
- **Fetch Player Stats**: Use the `fetch_nba_player_stats` function to retrieve statistics for a specific NBA player.
- **League Rules**: Access the `get_league_rules_prompt` function to obtain a template that outlines the league rules.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.
