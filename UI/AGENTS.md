# UI Guidance

This folder contains a Streamlit analytics application for this repository.

Primary requirement copied from the project request:

"Can you help me create a impactful Streamlit app code in separate folder called UI.. so that a data science manager can visualize the raw data, final data and model artifacts, member level data, predictions and top drivers for each member. Feel free to add more functionalities which will make this codebase more useful and powerful for doing analytics and understanding data"

Local guardrails for work inside `UI/`:

- Keep all UI code self-contained within this folder unless a shared root dependency update is explicitly needed.
- Do not change pipeline logic just to support the UI unless a human explicitly requests it.
- Prefer reading existing generated files from `data/raw`, `data/staging`, and `data/processed`.
- Optimize for a data science manager audience: fast context, clear KPIs, trustworthy tables, and explainable model outputs.
- Favor deterministic views over mock data.
- Add documentation for how to launch the app locally.

Recommended UI capabilities:

- Executive summary of data and model health.
- Raw, staging, processed, and artifact dataset exploration.
- Member-level risk drilldown with prediction and top drivers.
- Model metrics, coefficients, score bands, and artifact browsing.
- Data dictionary and report viewing.
