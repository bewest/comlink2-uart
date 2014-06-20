
## Use node usb to bridge usb to serial

This hack uses socat to create two fake serial ports.
You'll need 3 terminals for this.

1. one to run socat
1. one for the node usb-serial bridge
1. one to run python decocare tools

### socat
Socat looks like this:
You can run `./examples/setup_socat.sh` which will configure
everything and print something like this:
```bash
bewest@patient:~/src/comlink2-uart$ ./examples/setup_socat.sh
setting up socat
Notice the devices created, it will say: N PTY is ...
Then in one terminal run: node ./examples/bridge.js /dev/pts/xx
Then in another terminal to test the connection run: python -m decocare.stick /dev/pts/yy
Then run anything you want, eg: mm-send-comm.py  --port /dev/pts/yy  sleep 0
Replace xx and yy with the appropriate output from socat on the next lines
2014/06/20 16:01:11 socat[26856] N PTY is /dev/pts/29
2014/06/20 16:01:11 socat[26856] N PTY is /dev/pts/30
2014/06/20 16:01:11 socat[26856] N starting data transfer loop with FDs [3,3] and [5,5]
^C2014/06/20 16:01:24 socat[26856] N exiting on signal 2
bewest@patient:~/src/comlink2-uart$

```

In this example, these would be the relevant commands:
* `node examples/bridge.js /dev/pts/29`
* `python -m decocare.stick /dev/pts/30`

If this works you can use the other tools as well.
For example:
```bash
# turn on RF and say hello
mm-send-comm.py --port /dev/pts/30 --init sleep 0
mm-send-comm.py --port /dev/pts/30 --init sleep 0

# grab and dump json of first 4 pages
./bin/mm-pages.py --port /dev/pts/30 history 0-3
```

