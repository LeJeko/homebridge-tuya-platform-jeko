# homebridge-tuya-platform-jeko

[![npm](https://badgen.net/npm/v/homebridge-tuya-platform-jeko)](https://www.npmjs.com/package/homebridge-tuya-platform-jeko)
[![npm](https://badgen.net/npm/dt/homebridge-tuya-platform-jeko)](https://www.npmjs.com/package/homebridge-tuya-platform-jeko)
[![mit-license](https://badgen.net/npm/license/homebridge-tuya-platform-jeko)](https://www.npmjs.com/package/homebridge-tuya-platform-jeko/blob/main/LICENSE)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Build and Lint](https://github.com/LeJeko/homebridge-tuya-platform-jeko/actions/workflows/build.yml/badge.svg)](https://github.com/LeJeko/homebridge-tuya-platform-jeko/actions/workflows/build.yml)
[![join-discord](https://badgen.net/badge/icon/discord?icon=discord&label=homebridge/tuya)](https://discord.gg/homebridge-432663330281226270)


Fork of beta version of the official Tuya Homebridge plugin.

**This fork focus on Garage door integration with RF Remote**
Modification are done to allow best simulation without door contact, like WiFi to RF Remote converter (YET6956WTR).
For example, the Tuya API stores the remote button state, but the device can only store one signal per button and always sends the command (open) regardless of whether it receives true or false.
If `auto_close` option is set to `false`, that mean the garage door need to receive the signal of the same button to close.


## Tuya Open API
Follow instructions from the original beta fork to connect to Tuya API platform:
https://github.com/0x5e/homebridge-tuya-platform

You also need to change *device instructions* to DP (Data Point) from Tuya ioT portal.

## Plugin Options

The category is overridden to `ckmkzq` for simulating a HomeKit Garage Door Opener.

- Adjust the code `key_type_1` to match the remote button you need (Model YET6956WTR has 4).
- Set `open_time` to match your door travel time.
- Set `auto_close` if your garage door automatically closes after `stay_open_time`.

## config example
You can also manage those settings from Homebridge UI
```json
...
"deviceOverrides": [
            {
                "id": "xxxxxxxxxxxxxxxxxxx",
                "category": "ckmkzq", // Tuya Garage Door category
                "open_time": 10,
                "auto_close": true,
                "stay_open_time": 15,
                "schema": [
                    {
                        "code": "key_type_1",
                        "newCode": "switch_1",
                        "type": "Boolean"
                    },
                    {
                        "code": "doorcontact_state",
                        "newCode": "doorcontact_state",
                        "type": "Boolean"
                    }
                ]
            }
        ],
...
```
