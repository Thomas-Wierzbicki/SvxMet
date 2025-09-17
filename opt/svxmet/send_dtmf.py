#!/usr/bin/env python3
"""
Minimaler DTMF-Tester:
Schreibt eine DTMF-Sequenz in /dev/shm/dtmf_ctrl.

Usage:
  sudo -u svxlink python3 /opt/svxmet/send_dtmf.py "*123#"
"""
import os
import sys
import time

DTMF_CTRL = "/dev/shm/dtmf_ctrl"

def main():
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <DTMF-sequence>")
        print("Example: sudo -u svxlink python3 /opt/svxmet/send_dtmf.py \"*123#\"")
        return 1

    seq = sys.argv[1]

    if not os.path.exists(DTMF_CTRL):
        print(f"Error: {DTMF_CTRL} does not exist. Is SvxLink running and configured to create the PTY/FIFO?")
        return 2

    # Try opening and writing (use os.open to avoid shell redirection permission issues)
    try:
        # Open for writing only
        fd = os.open(DTMF_CTRL, os.O_WRONLY | os.O_NONBLOCK)
    except PermissionError as e:
        print(f"Permission denied opening {DTMF_CTRL}: {e}")
        print("Try: sudo -u svxlink python3 " + " ".join(sys.argv))
        return 3
    except BlockingIOError:
        # no reader yet - open blocking instead
        try:
            fd = os.open(DTMF_CTRL, os.O_WRONLY)
        except Exception as e:
            print(f"Failed to open {DTMF_CTRL}: {e}")
            return 4
    except Exception as e:
        print(f"Failed to open {DTMF_CTRL}: {e}")
        return 4

    try:
        # Ensure we send newline if needed (SvxLink usually expects raw digits)
        to_send = seq
        # write bytes
        os.write(fd, to_send.encode())
        # small pause to ensure delivery
        time.sleep(0.05)
        print(f"Sent DTMF sequence: {seq}")
    except Exception as e:
        print(f"Error writing to {DTMF_CTRL}: {e}")
        return 5
    finally:
        try:
            os.close(fd)
        except Exception:
            pass

    return 0

if __name__ == "__main__":
    sys.exit(main())
