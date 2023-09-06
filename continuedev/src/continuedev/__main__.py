import argparse

from .server.main import run_server


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("-p", "--port", help="server port", type=int, default=65432)
    parser.add_argument("--host", help="server host", type=str, default="127.0.0.1")
    args = parser.parse_args()

    run_server(port=args.port, host=args.host)


if __name__ == "__main__":
    main()
