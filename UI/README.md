# Streamlit Risk Review UI

This folder contains a simpler Streamlit app focused on four things:

- raw source table viewing
- final dataset review
- member-level detail
- high-risk member deep dives

## Run

```powershell
python -m pip install -r UI\requirements.txt
streamlit run UI\app.py
```

## Main Screens

- `High-Risk Review`: review queue plus deep dive for high-risk members
- `Member Detail`: one-member view with top drivers and feature snapshot
- `Final Dataset`: searchable table view over `final_member_dataset.csv`
- `Raw Data`: simple browser for source CSV files
