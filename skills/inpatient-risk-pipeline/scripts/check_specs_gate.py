import argparse
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--specs-path", required=True)
    parser.add_argument("--approval-key", default="final_data_approved")
    args = parser.parse_args()

    specs_path = Path(args.specs_path)
    text = specs_path.read_text(encoding="utf-8")
    approved_tokens = [
        f"{args.approval_key}: true",
        f"{args.approval_key}: True",
        f"{args.approval_key}: yes",
        f"{args.approval_key}: Yes",
    ]
    if any(token in text for token in approved_tokens):
        print(f"Approval gate passed using {specs_path}")
        return

    print(f"Approval gate blocked. Missing `{args.approval_key}: true` in {specs_path}")
    sys.exit(1)


if __name__ == "__main__":
    main()
