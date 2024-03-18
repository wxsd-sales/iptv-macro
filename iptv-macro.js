/********************************************************
 *
 * Macro Author:      	William Mills
 *                    	Technical Solutions Specialist
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 *
 * Version: 1-0-0
 * Released: 03/06/24
 *
 * This is an example IPTV Macro for Cisco RoomOS Devices.
 * 
 *
 * Full Readme, source code and license agreement available on Github:
 * https://github.com/wxsd-sales/iptv-macro
 *
 ********************************************************/

import xapi from "xapi";

/*********************************************************
 * Configure the settings below
 **********************************************************/

const config = {
  button: {
    name: "IPTV", // The main button name on the UI and its Panel Page Tile
    color: "#6F739E", // Color of the button
    icon: "Tv", // Specify which prebuilt icon you want. eg. Concierge | Tv
    showInCall: true
  },
  hlsPlayerUrl: "https://wxsd-sales.github.io/iptv-macro/webapp/", // URL of the HLS player Web App 
  contentServer: 'https://iptv-org.github.io/iptv/countries/int.m3u',
  validateStreams: true,      // Validate Streams can be played in Embedded Player before display in channel list (can take some time)
  autoDeleteWebCache: true,   // Auto Delete Web Storage Cache once the player has closed
  closeContentWithPanel: false, // Close the Content when the Panel is closed, useful for Devices with a controller
  username: "iptv", // Name of the local integration account which used for the websocket connect
  panelId: "iptv", // Modify if you have multiple copies of this marcro on a single device
};

/*********************************************************
 * Main functions and event subscriptions
 **********************************************************/

let openingWebview = false;
let integrationViews = [];
let panelOpen = false;
let content = [];
let selectedChannel;
let syncUITimer = null


// Don't start macro on Devices without WebEngine Support
xapi.Config.WebEngine.Mode.get()
  .then((mode) => init(mode))
  .catch((error) =>
    console.warn("WebEngine not available:", JSON.stringify(error))
  );

async function init(webengineMode) {
  const username = config.username;

  if (webengineMode === "Off") {
    console.log("WebEngine Currently [Off] setting to [On]");
    xapi.Config.WebEngine.Mode.set("On");
  }

  xapi.Config.WebEngine.Features.AllowDeviceCertificate.set("True");
  xapi.Config.HttpClient.Mode.set("On");

  await createPanels('loading');

  let channels = await getContent(config.contentServer)

  console.log('Number of channels found:', channels.length)

  if (config.validateStreams) {
    console.log('Validating and filtering channels')
    content = await filterContent(channels)
  } else {
    content = channels
  }

  //console.log(JSON.stringify(content))

  xapi.Command.UserManagement.User.Get({ Username: username, })
    .then(() => deleteAccount())
    .catch(() => console.log(`[${config.username}] account not present - no need for cleanup`));


  if(await checkIfPlayerIsOpen()){
    await createPanels('controls');
  } else {
    await createPanels('content');
  }
  

  // Listen and process Widget Clicks and releases
  xapi.Event.UserInterface.Extensions.Widget.Action.on(processWidget);

  // Listen and Process Page Close & Open Events if close content with Panel is enabled
  if (config.closeContentWithPanel) {
    xapi.Event.UserInterface.Extensions.Event.PageClosed.on(processPageClose);
    xapi.Event.UserInterface.Extensions.Event.PageOpened.on(processPageOpen);
  }

  // Listen and Process WebView Status changes
  xapi.Status.UserInterface.WebView.on(processWebViews);

  // Listen and Process Volume Status changes
  xapi.Status.Audio.VolumeMute.on(processVolumeMute);
  xapi.Status.Audio.Volume.on(proccessVolumeChange);
}

/*********************************************************
 * Creates a Local User account with Integrator & Users Roles
 **********************************************************/
function createAccount(password) {
  console.log(
    `Creating Account [${config.username}] with password [${password}]`
  );
  return xapi.Command.UserManagement.User.Add({
    Active: "True",
    Passphrase: password,
    PassphraseChangeRequired: "False",
    Role: ["Integrator", "User"],
    ShellLogin: "True",
    Username: config.username,
  })
    .then(() => console.log(`Account [${config.username}] created`))
    .catch(() => {
      console.log(`Account [${config.username}] already present - updating password`)
      xapi.Command.UserManagement.User.Passphrase.Set({ NewPassphrase: password, Username: config.username })
    });
}

/*********************************************************
 * Deletes the Local User account
 **********************************************************/
function deleteAccount() {
  console.log(`Deleting user [${config.username}]`);
  return xapi.Command.UserManagement.User.Delete({ Username: config.username })
    .then((result) => {

      if (result.status == 'OK') console.log(`Account [${config.username}] deleted`);

    })
    .catch((error) => {
      console.log("Error caught", error);
      if (!error.message.endsWith("does not exist")) {


      } else {
        console.log(error.message);
      }
    });
}

/*********************************************************
 * Generates a Password with for a given lenght
 **********************************************************/
function createPassword(length = 255) {
  if (length < 1 || length > 255) length = 255;
  const chars =
    "0123456789abcdefghijklmnopqrstuvwxyz!@#$%^&*()ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let password = "";
  for (let i = 0; i < length; i++) {
    let randomNumber = Math.floor(Math.random() * chars.length);
    password += chars.substring(randomNumber, randomNumber + 1);
  }
  return password;
}

/*********************************************************
 * Creates Base64 Encoded URL Hash Parameter 
 **********************************************************/
async function generateHash(link) {
  const ipAddress = await xapi.Status.Network[1].IPv4.Address.get();
  const password = createPassword(255);
  await createAccount(password);
  return btoa(
    JSON.stringify({
      username: config.username,
      password: password,
      ipAddress: ipAddress,
      panelId: config.panelId,
      link,
    })
  );
}


/*********************************************************
 * Opens Web View on OSD
 **********************************************************/
async function openWebview(content) {
  console.log(`Opening [${content.name}] on [OSD]`);
  openingWebview = true;
  const hash = await generateHash(content.link);
  xapi.Command.UserInterface.WebView.Display({
    Mode: content.mode,
    Title: content.name,
    Target: "OSD",
    Url: config.hlsPlayerUrl + "#" + hash,
  })
    .then((result) => {
      console.log("WebView opened on [OSD] ");
    })
    .catch((e) => console.log("Error: " + e.message));

  // Use this timeout to handle situations where the user opened
  // the content from a Board or Desk device and caused a panel close event
  setTimeout(() => {
    openingWebview = false;
  }, 500);
}



/*********************************************************
 * Closes Web View on OSD
 **********************************************************/
async function closeWebview() {
  console.log('Closing WebView on OSD')
  xapi.Command.UserInterface.WebView.Clear({ Target: "OSD" })
    .then(() => {
      if (config.autoDeleteWebCache) deleteWebAppStorage();
    })
}

/*********************************************************
 * Process all Widget Action Events
 **********************************************************/
async function processWidget(e) {
  if (!e.WidgetId.startsWith(config.panelId)) return;
  const [panelId, command, option] = e.WidgetId.split("-");
  const playerOpen = await checkIfPlayerIsOpen();
  switch (command) {
    case "selection":
      if (e.Type != "clicked") return;
      console.log('Selection', e)
      selectedChannel = parseInt(option)
      if (playerOpen) {
        console.log('Player open, sending new link')
        xapi.Command.Message.Send({ Text: JSON.stringify(content[selectedChannel]) })
      } else {
        openWebview(content[option]);
        await createPanels('controls');
        console.log('PanelId', panelId, 'config.panelId', config.panelId, ' replaced with ""', panelId.replace(config.panelId, ''))
        await goToControls(panelId.replace(config.panelId, ''))
      }
      break;
    case "close":
      if (e.Type != "clicked") return;
      console.log("User selected [close] - Closing WebView")
      closeWebview();
      createPanels('content');
      break;
    case "changechannel":
      if (e.Type != "clicked") return;
      if (!playerOpen) return
      console.log('Current selected channel', selectedChannel, ' content lenght', content.length, e.Value)
      if (e.Value == "increment") {
        if (selectedChannel == content.length - 1) {
          selectedChannel = 0;
          xapi.Command.Message.Send({ Text: JSON.stringify(content[selectedChannel]) })
        } else {
          selectedChannel = selectedChannel + 1;
          xapi.Command.Message.Send({ Text: JSON.stringify(content[selectedChannel]) })
        }

      } else if (e.Value == "decrement") {
        if (selectedChannel == 0) {
          selectedChannel = content.length - 1;
          xapi.Command.Message.Send({ Text: JSON.stringify(content[selectedChannel]) })
        } else {
          selectedChannel = selectedChannel - 1;
          xapi.Command.Message.Send({ Text: JSON.stringify(content[selectedChannel]) })
        }

      }
      console.log('Changing Channel to: ', content[selectedChannel])
    case "devicecontrols":
      switch (option) {
        case 'togglemute':
          if (e.Type != "clicked") return;
          xapi.Command.Audio.Volume.ToggleMute();
          break;
        case 'volume':
          if (e.Type != "released") return;
          const mapped = Math.round((e.Value) / 255 * 100)
          xapi.Command.Audio.Volume.Set({ Level: mapped });
          break;
      }
  }
}

/*********************************************************
 * Processes System Volume Changes and updates the custom
 * volume slider value to match
 **********************************************************/
function proccessVolumeChange(value) {
  const mapped = Math.round((value / 100) * 255)
  console.log('Volume changed', value, 'setting slider to', mapped)
  xapi.Command.UserInterface.Extensions.Widget.SetValue({
    Value: mapped,
    WidgetId: config.panelId + '-devicecontrols-volume'
  })
    .catch(err => console.log('Volume Slider not visible'))
}

/*********************************************************
 * Processes System Volume Mute and updates the custom mute
 * buttons active / inactive state
 **********************************************************/
function processVolumeMute(state) {
  xapi.Command.UserInterface.Extensions.Widget.SetValue({
    Value: state == 'On' ? 'active' : 'inactive',
    WidgetId: config.panelId + '-devicecontrols-togglemute'
  })
    .catch(err => console.log('Volume Mute not visible'))
}


/*********************************************************
 * Processes Channel or Controls page close events
 **********************************************************/
async function processPageClose(event) {
  if (!config.closeContentWithPanel) return
  if (!event.PageId.startsWith(config.panelId)) return;
  if (openingWebview) return;

  const controllers = await anyControllers();
  console.log('controllers', controllers)
  if (!controllers) return
  panelOpen = false;

  xapi.Status.SystemUnit.State.NumberOfActiveCalls.get().then((value) => {
    console.log('active calls', value)
    if (value == 1) return;
    setTimeout(() => {
      if (!panelOpen) {
        console.log("Page Closed - cleaning up");
        closeWebview();
        createPanels('content');
      }
    }, 300)
  });
}

/*********************************************************
 * Processes Channel or Controls page open events
 **********************************************************/
function processPageOpen(event) {
  if (!event.PageId.startsWith(config.panelId)) return;
  console.log("Panel Opened", event.PageId);
  panelOpen = true;
}

/*********************************************************
 * Sync the System Volume and Mute state for custom Widgets
 **********************************************************/
function syncUI() {

    xapi.Status.Audio.VolumeMute.get()
    .then(value => processVolumeMute(value));
    xapi.Status.Audio.Volume.get()
    .then(value => proccessVolumeChange(value));
  

}

/*********************************************************
 * Checks if the HLS player is open
 **********************************************************/
async function checkIfPlayerIsOpen() {
  const webViews = await xapi.Status.UserInterface.WebView.get()
  if (!webViews) return false
  const playerPresent = webViews.filter(webView => webView?.URL.startsWith(config.hlsPlayerUrl))
  return playerPresent.length > 0
}

/*********************************************************
 * Process any changes to the Web Views status
 **********************************************************/
async function processWebViews(event) {
  if (event.hasOwnProperty("Status") && event.hasOwnProperty("Type") && event.hasOwnProperty("URL")) {
    if (event.Status !== "Visible" || event.Type !== "Integration") return;
    if (!openingWebview) return;
    if (!event.URL.startsWith(config.hlsPlayerUrl)) return
    console.log(`Recording Integration WebView id [${event.id}]`);
    integrationViews.push(event);
  } else if (event.hasOwnProperty("ghost")) {
    const result = integrationViews.findIndex(
      (webview) => webview.id === event.id
    );
    if (result === -1) return;
    console.log(
      `Integration WebView id [${event.id}] ghosted - closing all Integration WebViews`
    );
    deleteAccount();
    integrationViews = [];
    setTimeout(createPanels, 300, 'content')
  }
}


/*********************************************************
 * Gets the Stream content from provided server URL
 **********************************************************/
function getContent(server) {
  console.log("Checking server URL: " + server);
  return xapi.Command.HttpClient.Get({ Url: server })
    .then(async (r) => {
      if (r.StatusCode != "200") return;

      const jsonData = convertM3u(r.Body)


      return jsonData
    })
    .catch((e) => {
      console.log("Error getting content: " + e.message);
      return content.length == 0 ? [] : content;
    });
}

async function createPanels(state) {
  await createPanel(state, config.button.showInCall ? "HomeScreenAndCallControls" : "HomeScreen")
  await createPanel(state, 'ControlPanel')
  setTimeout(syncUI, 500)
}


/*********************************************************
 * Creates Macro Panel in either Loading | content | playercontrol states
 **********************************************************/
async function createPanel(state, location) {
  const button = config.button;
  const panelId = config.panelId;

  console.log(`Creating Panel [${panelId}+${location}] with state [${state}]`);

  let channels = ''
  let controls = ''

  function widget(id, type, name, options) {
    return `<Widget><WidgetId>${panelId}${location}-${id}</WidgetId>
            <Name>${name}</Name><Type>${type}</Type>
            <Options>${options}</Options></Widget>`;
  }

  function row(widgets = "") {
    return Array.isArray(widgets)
      ? `<Row>${widgets.join("")}</Row>`
      : `<Row>${widgets}</Row>`;
  }

  function createChannelsPage(content) {
    let rows = '';

    if (content == undefined || content.length < 0) {
      console.log(`No content available to show for [${panelId}]`);
      rows = row(
        widget("no-content", "Text", "No Content Available", "size=4;fontSize=normal;align=center"
        )
      );
    } else {
      for (let i = 0; i < content.length; i++) {
        rows = rows.concat(row(widget(`selection-${i}`, "Button", content[i].name, "size=3")));
      }
    }

    return `<Page>
              <Name>Channels</Name>
              ${rows}
              <PageId>${panelId}${location}-channels</PageId>
              <Options>hideRowNames=1</Options>
            </Page>`

  }

  function createControlsPage(visible) {
    let playerControls = `<Row>
                        <Widget>
                          <WidgetId>${panelId}-player-not-visible</WidgetId>
                          <Name>Player Closed. Please select a channel</Name>
                          <Type>Text</Type>
                          <Options>size=3;fontSize=normal;align=center</Options>
                          </Widget>
                        </Row>`;
    let closeButton = '';
    if (visible) {
      playerControls = `<Row>
                        <Widget>
                          <WidgetId>${panelId}-playercontrols-playpause</WidgetId>
                          <Type>Button</Type>
                          <Options>size=1;icon=play_pause</Options>
                        </Widget>
                          <Widget>
                            <WidgetId>${panelId}-changechannel</WidgetId>
                            <Type>Spinner</Type>
                            <Options>size=2;style=vertical</Options>
                          </Widget>
                        </Row>
                        <Row>
                        <Widget>
                          <WidgetId>${panelId}-player-audio-text</WidgetId>
                          <Name>Player Audio Controls</Name>
                          <Type>Text</Type>
                          <Options>size=3;fontSize=normal;align=center</Options>
                          </Widget>
                        </Row>
                        <Row>
                        <Widget>
                          <WidgetId>${panelId}-playercontrols-togglemute</WidgetId>
                          <Type>Button</Type>
                          <Options>size=1;icon=volume_muted</Options>
                        </Widget>
                        <Widget>
                          <WidgetId>${panelId}-playercontrols-volume</WidgetId>
                          <Type>Slider</Type>
                          <Options>size=3</Options>
                        </Widget>
                      </Row>`

      closeButton = `<Row>
                      <Widget>
                        <WidgetId>${panelId}-close</WidgetId>
                        <Name>Close Content</Name>
                        <Type>Button</Type>
                        <Options>size=4</Options>
                      </Widget>
                    </Row>`
    }
    return `<Page>
              <Name>Controls</Name>
            ${playerControls}
            <Row>
            <Widget>
                <WidgetId>${panelId}-device-audio-text</WidgetId>
                <Name>Device Audio Controls</Name>
                <Type>Text</Type>
                <Options>size=3;fontSize=normal;align=center</Options>
                </Widget>
            </Row>
            <Row>
              <Widget>
                <WidgetId>${panelId}-devicecontrols-togglemute</WidgetId>
                <Type>Button</Type>
                <Options>size=1;icon=volume_muted</Options>
              </Widget>
              <Widget>
                <WidgetId>${panelId}-devicecontrols-volume</WidgetId>
                <Type>Slider</Type>
                <Options>size=3</Options>
              </Widget>
            </Row>
              ${closeButton}
              <PageId>${panelId}${location}-controls</PageId>
              <Options>hideRowNames=1</Options>
            </Page>`
  }


  switch (state) {
    case "loading":
      channels = `<Page>
                    <Name>Loading</Name>
                    <Row>
                      <Widget>
                        <WidgetId>${panelId}-loading-text</WidgetId>
                        <Name>IPTV Channel List is loading...</Name>
                        <Type>Text</Type>
                        <Options>size=3;fontSize=normal;align=center</Options>
                      </Widget>
                    </Row>
                    <PageId>${panelId}-channels</PageId>
                    <Options>hideRowNames=1</Options>
                  </Page>`
      break
    case "content":
    case "controls":
      channels = createChannelsPage(content);
      controls = createControlsPage(state == 'controls');
  }

  let order = "";
  const orderNum = await panelOrder(panelId + location);
  if (orderNum != -1) order = `<Order>${orderNum}</Order>`;

  const panel = `
    <Extensions><Panel>
      <Location>${location}</Location>
      <Icon>${button.icon}</Icon>
      <Color>${button.color}</Color>
      <Name>${button.name}</Name>
      ${order}
      <ActivityType>Custom</ActivityType>
      ${channels}
      ${controls}
    </Panel></Extensions>`;

  return xapi.Command.UserInterface.Extensions.Panel.Save(
    { PanelId: panelId + location },
    panel
  )
}

/*********************************************************
 * Gets the current Panel Order if exiting Macro panel is present
 * to preserve the order in relation to other custom UI Extensions
 **********************************************************/
async function panelOrder(panelId) {
  const list = await xapi.Command.UserInterface.Extensions.List({
    ActivityType: "Custom",
  });
  if (!list.hasOwnProperty("Extensions")) return -1;
  if (!list.Extensions.hasOwnProperty("Panel")) return -1;
  if (list.Extensions.Panel.length == 0) return -1;
  for (let i = 0; i < list.Extensions.Panel.length; i++) {
    if (list.Extensions.Panel[i].PanelId == panelId)
      return list.Extensions.Panel[i].Order;
  }
  return -1;
}

/*********************************************************
 * Converts the provided M3U file into JSON format
 * It also filters any HTTP streams if the HLS Player is
 * set to a HTTPS URL and would therefore be blocked by the browser
 **********************************************************/
function convertM3u(file) {
  const httpsOnly = config.hlsPlayerUrl.startsWith('https')
  console.log('httpsonly', httpsOnly)
  let jsonData = []
  let lines = file.split('\n');
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (line.startsWith('#EXTINF')) {
      let newChannel = {}
      newChannel['name'] = line.split(',').pop();
      line = line.substring(0, line.length - newChannel['name'].length)
      let fields = line.split(' ')
      for (let j = 0; j < fields.length; j++) {
        let field = fields[j];
        if (field.includes('=')) {
          let [fieldname, value] = field.split('=')
          newChannel[fieldname] = value.substring(1, value.length - 1)
        }
      }
      // Walk throught lines and find link
      for (let l = i + 1; l < lines.length; l++) {
        if (lines[l].startsWith('https:')) {
          newChannel['link'] = lines[l];
          jsonData.push(newChannel);
          break;
        } else if (lines[l].startsWith('http:') && !httpsOnly) {
          newChannel['link'] = lines[l];
          jsonData.push(newChannel);
          break;
        } else if (lines[l].startsWith('http:') && httpsOnly) {
          break;
        }
      }
    }
  }
  return jsonData
}

/*********************************************************
 * Loops thought provided provided JSON M3U streams
 * and filters our streams which couldn't be possible to play
 **********************************************************/
async function filterContent(json) {
  const numOfChannels = json.length;
  let filtered = []
  for (let i = 0; i < numOfChannels; i++) {
    udpateLoadingText(`Validating and filtering channels: [ ${i + 1} /  ${numOfChannels}]   Please Wait 😃 `)
    const valid = await checkCORs(json[i].link)
    //console.log(json[i].link, ' result = ', valid)
    if (valid) filtered.push(json[i])
  }
  return filtered
}

/*********************************************************
 * Checks the response header for 'access-control-allow-orgin' = *
 * for each stream to ensure it can be opened as an embedded stream
 **********************************************************/
function checkCORs(link) {
  console.log("Checking CORs for Link: " + link);
  return xapi.Command.HttpClient.Get({ Url: link })
    .then((r) => {
      //console.log('link', link, ' body', JSON.stringify(r.Headers))
      if (r.StatusCode != "200") return false
      const headers = r.Headers
      for (let i = 0; i < headers.length; i++) {
        if (headers[i].Key.toLowerCase() == 'access-control-allow-origin' && headers[i].Value == '*')
          return true
      }
      return false
    })
    .catch((e) => {
      //console.log(JSON.stringify(e))
      if (e?.data?.StatusCode == "302" || e?.data?.StatusCode == "301") return handleRedirect(e.data, checkCORs)
      console.log("Error getting content: " + e.message);
      console.log(e);
      return content.length == 0 ? [] : content;
    });
}

/*********************************************************
 * Gets the new redirect location from the provided headers
 **********************************************************/
function handleRedirect(data, request) {
  const headers = data.Headers
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].Key.toLowerCase() == 'location')
      return request(headers[i].Value)
  }
}

/*********************************************************
 * Deletes the Web App storage off the device
 **********************************************************/
function deleteWebAppStorage() {
  console.log('Deleting Web App Storage')
  xapi.Command.WebEngine.DeleteStorage({ Type: 'WebApps' });
}

/*********************************************************
 * Checks if there are any controllers connected
 **********************************************************/
async function anyControllers() {
  const peripherals = await xapi.Status.Peripherals.ConnectedDevice.get()
  const touchPanels = peripherals.filter(device => device.Type == 'TouchPanel')
  return touchPanels.length > 0
}

/*********************************************************
 * Go to Control Page
 **********************************************************/
function goToControls(location) {
  const panelId = config.panelId
  console.log('Going to PanelId', panelId+location , ' - PageId ', panelId + location + '-controls')
  return xapi.Command.UserInterface.Extensions.Panel.Open(
    { PageId: panelId + location + '-controls', PanelId: panelId + location })
}

/*********************************************************
 * Updates Loading Text as Channels are filtered and processed
 **********************************************************/
function udpateLoadingText(text) {
  xapi.Command.UserInterface.Extensions.Widget.SetValue({
    Value: text,
    WidgetId: config.panelId + '-loading-text'
  })
    .catch(err => console.log('Volume Mute not visible'))
}
