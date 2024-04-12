# IPTV Macro

This Webex Device macro lets view and control Live or VOD content on your Webex Device within a Web View and also lets you control the HTML player via UI Extensions. Therefore enabling users to launch content on the non interactive display of your Webex Device and control the player from an in room controller.

![IPTV Macro](https://github.com/wxsd-sales/iptv-macro/assets/21026209/5de8b711-fd16-41cd-af4f-f2f7057ed0ac)

## Overview

When the macro initilly runs, it gets a M3U8 playlist file from a reachable web server via HTTP Client xCommand. Then it parses and verifies the playlist links to ensure they can be played within the Web Apps Player by removing non HTTPS links and links which can't be played due to CORS.

When a user taps on an IPTV channel in the section, the macro will generate a URL Hash parameter containing the main devices IP address, local username/password and the link of the stream in which to initiall display.

If the user changes the channel while the Web App is open, the macro will send the new stream link as Message Send event which the Web App listens. The Web Apps had front end code which parses the new channel information and loads it in the player.

## Setup

### Prerequisites & Dependencies: 

- RoomOS/CE 11.8 or above Webex Device
- Web admin access to the device to upload the macro
- Network connectivity for your Webex Device to open the WebView content
- Web Server to host a copy of the Web App Player ( optional as GitHub pages version is already provided )
  ```
  https://wxsd-sales.github.io/iptv-macro/webapp/
  ```
- M3U8 playlist of live or VOD content ( optional - example already provided from iptv-org )
  
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
