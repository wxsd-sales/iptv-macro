# IPTV Macro

This Webex Device macro lets open IPTV content on your Webex Device as a WebView

## Overview

Upon startup, this macro gets a M3U8 playlist file from a reachable web server via a HTTP GET. Then it parses and verifies the playlist links to ensure they can be played in the Web Apps HLS Player.

When a user taps on an IPTV channel to view, the macro will generate a URL Hash parameter containing the main devices IP address, local username/password and the link of the stream in which to initiall display.

If the user changes the channel while the Web App is open, the macro will send the new stream link as Message Send event which the Web App listens for and parses the new channel and load it in the HLS player.

## Setup

### Prerequisites & Dependencies: 

- RoomOS/CE 10.x or above Webex Device
- Web admin access to the device to upload the macro
- Network connectivity for your Webex Device to open the WebView content you want to display

### Installation Steps:

1. Download the ``iptv-macro.js`` file and upload it to your Webex Room devices Macro editor via the web interface.
2. Configure the Macro by changing the initial values, there are comments explaining each one.
3. Enable the Macro on the editor.

## Validation

Validated Hardware:

* Room Kit Pro + Touch 10
* Desk Pro + Room Navigator

This macro should work on other Webex Devices with WebEngine support but has not been validated at this time.

## Demo

*For more demos & PoCs like this, check out our [Webex Labs site](https://collabtoolbox.cisco.com/webex-labs).


## License

All contents are licensed under the MIT license. Please see [license](LICENSE) for details.


## Disclaimer

Everything included is for demo and Proof of Concept purposes only. Use of the site is solely at your own risk. This site may contain links to third party content, which we do not warrant, endorse, or assume liability for. These demos are for Cisco Webex usecases, but are not Official Cisco Webex Branded demos.


## Questions
Please contact the WXSD team at [wxsd@external.cisco.com](mailto:wxsd@external.cisco.com?subject=iptv-macro) for questions. Or, if you're a Cisco internal employee, reach out to us on the Webex App via our bot (globalexpert@webex.bot). In the "Engagement Type" field, choose the "API/SDK Proof of Concept Integration Development" option to make sure you reach our team. 
