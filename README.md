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
- **Select Team**: Utilize the `select_team_based_on_build` function to choose players that fit a particular strategy, such as "punt free throw."
- **League Rules**: Access the `get_league_rules_prompt` function to obtain a template that outlines the league rules.

## Tools and Functionalities
- **fetch_player_stats.py**: Fetches player statistics from the BallDon'tLie API.
- **select_team.py**: Implements logic to select players based on defined strategies for fantasy basketball.
- **prompt_templates.py**: Provides templates for league rules to assist in player selection and strategy formulation.

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.