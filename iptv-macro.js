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
    title: "Tap To Open",
    showInCall: true,
    closeContentWithPanel: false, // Automatically close any open content when the panel closes
  },
  hlsPlayerUrl:
    "https://jsxapi.glitch.me/hls.html",
  contentServer:'https://iptv-org.github.io/iptv/countries/int.m3u',
  filterStreams: true,
  autoDeleteWebCache: true,
  username: "iptv", // Name of the local integration account which used for the websocket connect
  panelId: "iptv", // Modify if you have multiple copies of this marcro on a single device
};

/*********************************************************
 * Main functions and event subscriptions
 **********************************************************/

let openingWebview = false;
let integrationViews = [];
let content = [];


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

  createPanel('loading');

  content = await getContent(config.contentServer)

  console.log('Number of channels found:', content.length)

  //console.log(JSON.stringify(content))

  xapi.Command.UserManagement.User.Get({Username: username,})
  .then(()=>deleteAccount())
  .catch(() => console.log(`[${config.username}] account not present - no need for cleanup`));

  createPanel('content');

  xapi.Event.UserInterface.Extensions.Widget.Action.on(processWidget);
  xapi.Event.UserInterface.Extensions.Event.PageClosed.on((event) => {

    if (!event.PageId.startsWith(config.panelId)) return;
    if (openingWebview) return;

    xapi.Status.SystemUnit.State.NumberOfActiveCalls.get().then((value) => {
      if (value == 1) return;
      console.log("Panel Closed - cleaning up");
      closeWebview();
      createPanel('content');
      //deleteAccount();
    });
  });

  xapi.Event.UserInterface.Extensions.Event.PageOpened.on((event) => {
    if (!event.PageId.startsWith(config.panelId)) return;
    console.log("Panel Opened");
    //createPanel('content');
  });

  xapi.Status.UserInterface.WebView.on(processWebViews);

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
    .catch(() =>{
      console.log(`Account [${config.username}] already present - updating password`)
      xapi.Command.UserManagement.User.Passphrase.Set({ NewPassphrase: password, Username: config.username})
    });
}

/*********************************************************
 * Creates the Local User account
 **********************************************************/
function deleteAccount() {
  console.log(`Deleting user [${config.username}]`);
  return xapi.Command.UserManagement.User.Delete({ Username: config.username })
    .then((result) => {

      if(result.status == 'OK')console.log(`Account [${config.username}] deleted`);
      
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
  .then(()=>{
    if(config.autoDeleteWebCache) deleteWebAppStorage();
  })
}

/*********************************************************
 * Process all Widget Action Events
 **********************************************************/
async function processWidget(e) {
  if (!e.WidgetId.startsWith(config.panelId)) return;
  const [panelId, command, option] = e.WidgetId.split("-");
  if (e.Type != "clicked") return;
  switch (command) {
    case "selection":
      const playerOpen = await checkIfPlayerIsOpen();
      if(playerOpen){
        console.log('Player open, sending new link')
        xapi.Command.Message.Send({ Text: JSON.stringify(content[option])})
      }else{
        openWebview(content[option]);
        createPanel('playercontrols');
      }
      break;
    case "close":
      console.log("User selected [close] - Closing WebView")
      closeWebview();
      createPanel('content');
      break;
  }
}


/*********************************************************
 * Checks if the HLS player is open
 **********************************************************/
async function checkIfPlayerIsOpen(){
  const webViews = await xapi.Status.UserInterface.WebView.get()
  if(!webViews) return false
  const playerPresent = webViews.filter(webView=> webView?.URL.startsWith(config.hlsPlayerUrl))
  return playerPresent.length> 0
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

      if(!config.filterStreams) return jsonData

      const filteredResults = await filterContent(jsonData)
      return filteredResults
    })
    .catch((e) => {
      console.log("Error getting content: " + e.message);
      return content.length == 0 ? [] : content;
    });
}


/*********************************************************
 * Creates Macro Panel in either Loading | content | playercontrol states
 **********************************************************/
async function createPanel(state) {
  
  const button = config.button;
  const panelId = config.panelId;

  const mtr = await xapi.Command.MicrosoftTeams.List({ Show: 'Installed' })
    .catch(err => false)

  console.log(`Creating Panel [${panelId}] with state [${state}]`);

  let location = '';
  if (mtr) {
    location = `<Location>ControlPanel</Location>`
  } else {
    location = `<Location>${button.showInCall ? "HomeScreenAndCallControls" : "HomeScreen"}</Location>
                <Type>${button.showInCall ? "Statusbar" : "Home"}</Type>`
  }


  let pageName = config.button.title;

  
  let rows = "";

  function widget(id, type, name, options) {
    return `<Widget><WidgetId>${panelId}-${id}</WidgetId>
            <Name>${name}</Name><Type>${type}</Type>
            <Options>${options}</Options></Widget>`;
  }

  function row(widgets = "") {
    return Array.isArray(widgets)
      ? `<Row>${widgets.join("")}</Row>`
      : `<Row>${widgets}</Row>`;
  }


  switch (state) {
    case "loading":
      pageName = "Please Wait";
      rows = rows.concat(row(
          widget(
            "loading-text",
            "Text",
            "IPTV Channel List is loading...",
            "size=4;fontSize=normal;align=center"
          )
        ));

    break
    case "playercontrols":
      pageName = "Now Viewing:...";
      rows = rows.concat(
        row(widget("close", "Button", "Close Content", "size=2"))
      );
      rows = rows.concat(
        row([
          widget(
            "playercontrols-toggleMute",
            "Button",
            "",
            "size=1;icon=volume_muted"
          ),
          widget("playercontrols-systemvolume", "Slider", "", "size=3"),
        ])
      );

      if (content == undefined || content.length < 0) {
        console.log(`No content available to show for [${panelId}]`);
        rows = rows.concat(row(
          widget(
            "no-content",
            "Text",
            "No Content Available",
            "size=4;fontSize=normal;align=center"
          )
        ));
      } else {
        for (let i = 0; i < content.length; i++) {
          rows = rows.concat(
            row(
              widget(`selection-${i}`, "Button", content[i].name, "size=3")
            )
          );
        }
      }
      break;
    case "content":

      if (content == undefined || content.length < 0) {
        console.log(`No content available to show for [${panelId}]`);
        rows = row(
          widget(
            "no-content",
            "Text",
            "No Content Available",
            "size=4;fontSize=normal;align=center"
          )
        );
      } else {
        for (let i = 0; i < content.length; i++) {
          rows = rows.concat(
            row(
              widget(`selection-${i}`, "Button", content[i].name, "size=3")
            )
          );
        }
      }
  }



  let order = "";
  const orderNum = await panelOrder(config.panelId);
  if (orderNum != -1) order = `<Order>${orderNum}</Order>`;

  const panel = `
    <Extensions><Panel>
      ${location}
      <Type>${button.showInCall ? "Statusbar" : "Home"}</Type>
      <Icon>${button.icon}</Icon>
      <Color>${button.color}</Color>
      <Name>${button.name}</Name>
      ${order}
      <ActivityType>Custom</ActivityType>
      <Page>
        <Name>${pageName}</Name>
        ${rows}
        <PageId>${panelId}-page</PageId>
        <Options>hideRowNames=1</Options>
      </Page>
    </Panel></Extensions>`;

  return xapi.Command.UserInterface.Extensions.Panel.Save(
    { PanelId: panelId },
    panel
  );
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
      for(let l = i + 1; l < lines.length; l++){
        if(lines[l].startsWith('https:') ){
          newChannel['link'] = lines[l];
          jsonData.push(newChannel);
          break;
        } else if ( lines[l].startsWith('http:') && !httpsOnly ){
          newChannel['link'] = lines[l];
          jsonData.push(newChannel);
          break;
        } else if (lines[l].startsWith('http:')  && httpsOnly){
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
async function filterContent(json){
  let filtered = []
  for(let i = 0; i< json.length; i++){
    const valid = await checkCORs(json[i].link)
    //console.log(json[i].link, ' result = ', valid)
    if(valid) filtered.push(json[i])
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
      for(let i=0; i<headers.length; i++){
        if(headers[i].Key.toLowerCase() == 'access-control-allow-origin' && headers[i].Value == '*')
        return true
      }
      return false
    })
    .catch((e) => {
      //console.log(JSON.stringify(e))
      if(e?.data?.StatusCode == "302" || e?.data?.StatusCode == "301") return handleRedirect(e.data, checkCORs)
      console.log("Error getting content: " + e.message);
      console.log(e);
      return content.length == 0 ? [] : content;
    });
}

/*********************************************************
 * Gets the new redirect location from the provided headers
 **********************************************************/
function handleRedirect(data, request){
  const headers = data.Headers
  for(let i=0; i<headers.length; i++){
    if(headers[i].Key.toLowerCase() == 'location')
    return request(headers[i].Value)
  }

}

/*********************************************************
 * Deletes the Web App storage off the device
 **********************************************************/
function deleteWebAppStorage(){
  console.log('Deleting Web App Storage')
  xapi.Command.WebEngine.DeleteStorage({ Type: 'WebApps' });
}
