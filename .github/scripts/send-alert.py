#!/usr/bin/env python3
import os
import smtplib
import sys
from email.mime.text import MIMEText

to = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("REPORT_TO", "")
subject = os.environ.get("ALERT_SUBJECT", "DOWN ALERT")
body = os.environ.get("DOWN_VAR", "unknown services down")
msg = MIMEText(body)
msg["Subject"] = subject
msg["From"] = os.environ["SMTP_USER"]
msg["To"] = to
try:
    s = smtplib.SMTP("smtp.gmail.com", 587)
    s.starttls()
    s.login(os.environ["SMTP_USER"], os.environ["SMTP_PASS"])
    s.send_message(msg)
    s.quit()
    print("alert sent")
except Exception as e:
    print("alert failed:", e)
    raise SystemExit(2)
