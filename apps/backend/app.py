from wsgiref.simple_server import make_server

from video_lab.web import create_app


def main() -> None:
    app = create_app()
    port = 8000
    with make_server("0.0.0.0", port, app) as server:
        print(f"Video Lab running at http://127.0.0.1:{port}")
        server.serve_forever()


if __name__ == "__main__":
    main()
