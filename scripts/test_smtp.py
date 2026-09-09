import argparse
import socket
import smtplib
import ssl
import sys
import os
from email.message import EmailMessage
import datetime

sys.path.append(os.getcwd())

def test_smtp(args):
    print(f"--- SMTP Diagnostic Start ---")
    
    host = args.host
    port = args.port
    user = args.user
    password = args.password
    use_tls = args.tls

    # 1. DNS Resolution
    print(f"[1/5] DNS Resolution for {host}...", end=" ")
    try:
        ip = socket.gethostbyname(host)
        print(f"OK ({ip})")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    # 2. TCP Connection
    print(f"[2/5] TCP Connection to {host}:{port}...", end=" ")
    try:
        with socket.create_connection((host, port), timeout=args.timeout):
            print("OK")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    # 3. SMTP Handshake
    print(f"[3/5] SMTP Handshake...", end=" ")
    try:
        if args.use_ssl:
            smtp = smtplib.SMTP_SSL(host, port, timeout=args.timeout)
        else:
            smtp = smtplib.SMTP(host, port, timeout=args.timeout)
            smtp.ehlo()
        print("OK")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    # 4. STARTTLS/SSL
    print(f"[4/5] STARTTLS/SSL Negotiation...", end=" ")
    try:
        if args.tls and not args.use_ssl:
            context = ssl.create_default_context()
            smtp.starttls(context=context)
            smtp.ehlo()
        print("OK")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    # 5. Authentication
    print(f"[5/5] Authentication...", end=" ")
    try:
        if user and password:
            smtp.login(user, password)
            print("OK")
        else:
            print("SKIPPED (No credentials provided)")
    except Exception as e:
        print(f"FAIL: {e}")
        return

    if args.to:
        print(f"Sending test email to {args.to}...", end=" ")
        try:
            msg = EmailMessage()
            msg["Subject"] = "[Email Gateway] SMTP Test"
            msg["From"] = args.from_email
            msg["To"] = args.to
            msg.set_content(f"SMTP test successful at {datetime.datetime.now().isoformat()} on {host}")
            smtp.send_message(msg)
            print("[OK]")
        except Exception as e:
            print(f"[FAIL]: {e}")

    print("--- Diagnostic Successful ---")
    smtp.quit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SMTP Diagnostic Tool")
    parser.add_argument("--host", default="localhost", help="SMTP Host")
    parser.add_argument("--port", type=int, help="SMTP Port")
    parser.add_argument("--user", help="SMTP Username")
    parser.add_argument("--password", help="SMTP Password")
    parser.add_argument("--to", help="Recipient email address")
    parser.add_argument("--from-email", help="Sender email address")
    parser.add_argument("--no-tls", dest="tls", action="store_false", help="Disable STARTTLS")
    parser.add_argument("--ssl", dest="use_ssl", action="store_true", help="Use implicit SSL")
    parser.add_argument("--no-ssl", dest="use_ssl", action="store_false", help="Disable implicit SSL")
    parser.add_argument("--timeout", type=int, default=10, help="Connection timeout in seconds")
    parser.set_defaults(tls=True, use_ssl=None)
    
    args = parser.parse_args()
    
    try:
        from app.config import settings
        if not args.user: args.user = settings.smtp_username
        if not args.password: args.password = settings.smtp_password
        if args.host == "localhost": args.host = settings.smtp_host
        if args.port is None: args.port = settings.smtp_port
        if args.use_ssl is None:
            args.use_ssl = (args.port == 465)
        if not args.from_email: args.from_email = settings.smtp_from or settings.smtp_username
    except ImportError:
        if args.port is None: args.port = 587
        if args.use_ssl is None: args.use_ssl = False
        if not args.from_email: args.from_email = args.user or "test@example.com"

    test_smtp(args)
