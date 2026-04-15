import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]


def main() -> None:
    command = ["python", "-m", "pytest", "tests", "-q", "--basetemp=.pytest_tmp", "-p", "no:cacheprovider"]
    result = subprocess.run(command, cwd=ROOT)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
