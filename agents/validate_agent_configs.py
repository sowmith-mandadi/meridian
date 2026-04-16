from pathlib import Path


REQUIRED_KEYS = {
    "name",
    "role",
    "goal",
    "uses_skills",
    "inputs",
    "outputs",
    "handoffs_to",
    "guardrails",
}


def parse_toml_like(path: Path) -> dict:
    data = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        data[key.strip()] = value.strip()
    return data


def main() -> None:
    agent_dir = Path(__file__).resolve().parent
    failures = []
    for path in sorted(agent_dir.glob("*.toml")):
        parsed = parse_toml_like(path)
        missing = sorted(REQUIRED_KEYS.difference(parsed))
        if missing:
            failures.append(f"{path.name}: missing keys {missing}")
    if failures:
        for failure in failures:
            print(failure)
        raise SystemExit(1)
    print(f"Validated {len(list(agent_dir.glob('*.toml')))} agent config files")


if __name__ == "__main__":
    main()
