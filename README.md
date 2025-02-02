# homebridge-tuya-platform-jeko

[![npm](https://badgen.net/npm/v/homebridge-tuya-platform-jeko)](https://www.npmjs.com/package/homebridge-tuya-platform-jeko)
[![npm](https://badgen.net/npm/dt/homebridge-tuya-platform-jeko)](https://www.npmjs.com/package/homebridge-tuya-platform-jeko)
[![mit-license](https://badgen.net/npm/license/homebridge-tuya-platform-jeko)](https://www.npmjs.com/package/homebridge-tuya-platform-jeko/blob/main/LICENSE)
[![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)
[![Build and Lint](https://github.com/LeJeko/homebridge-tuya-platform-jeko/actions/workflows/build.yml/badge.svg)](https://github.com/LeJeko/homebridge-tuya-platform-jeko/actions/workflows/build.yml)
[![join-discord](https://badgen.net/badge/icon/discord?icon=discord&label=homebridge/tuya)](https://discord.gg/homebridge-432663330281226270)


Fork of a fork version of the official Tuya Homebridge plugin, with a focus on fixing bugs and adding new device support.

This fork focus on Garage door integration with Remote to Wifi device.

You need to change device instruction to DP from Tuya ioT portal.

## Override example

```json
"deviceOverrides": [
            {
                "id": "xxxxxxxxxxxxxxxxxxx",
                "category": "ckmkzq", // Tuya Garage Door category
                "open_time": 10,
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
```
