# UTE Energy Consumption Scraper (CLI)

A Node.js scraper that authenticates against **UTE (Uruguay) self-service portal**, retrieves the **daily energy consumption curve**, and renders it directly in the **terminal** using ASCII charts.

Perfect for:
- CLI analysis
- cron jobs
- SSH usage
- debugging
- future integrations (Home Assistant, databases, APIs, etc.)

---

## ✨ Features

- Automatic login to UTE self-service
- Daily energy consumption retrieval (kWh)
- Correct handling of date ranges crossing years
- Date normalization to ISO format (`YYYY-MM-DD`)
- ASCII chart rendering in the terminal
- Total energy consumption calculation

Example output:
 <img width="346" height="239" alt="image" src="https://github.com/user-attachments/assets/5b0b2274-878b-4907-8a8c-86010af11341" />
