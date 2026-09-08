"""Local SMTP sink for E2E testing: accepts mail, logs it to /tmp/smtp_sink_out.txt."""

import asyncio

from aiosmtpd.controller import Controller

OUT = "/tmp/smtp_sink_out.txt"


class Sink:
    async def handle_DATA(self, server, session, envelope):
        with open(OUT, "ab") as f:
            f.write(envelope.content)
            f.write(b"\n-----8<-----\n")
        print(f"RECEIVED from={envelope.mail_from} to={envelope.rcpt_tos}", flush=True)
        return "250 Message accepted for delivery"


async def main() -> None:
    controller = Controller(Sink(), hostname="127.0.0.1", port=8025)
    controller.start()
    print("SMTP sink listening on 127.0.0.1:8025", flush=True)
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
