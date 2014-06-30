#!/bin/bash

echo "setting up socat"
echo "Notice the devices created, it will say: N PTY is ..."
echo "Then in one terminal run: node ./examples/bridge.js /dev/pts/xx"
echo "Then in another terminal to test the connection run: python -m decocare.stick /dev/pts/yy"
echo "Then run anything you want, eg: mm-send-comm.py  --port /dev/pts/yy  sleep 0"
echo "Replace xx and yy with the appropriate output from socat on the next lines"
socat -d -d pty,raw,echo=0,b9600 pty,raw,echo=0,b9600

