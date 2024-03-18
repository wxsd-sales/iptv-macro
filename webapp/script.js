/********************************************************
 *
 * Script Author:      	William Mills
 *                    	Technical Solutions Specialist
 *                    	wimills@cisco.com
 *                    	Cisco Systems
 *
 * Version: 1-0-0
 * Released: 03/18/24
 *
 * This is an example IPTV HLS Player web app for the IPTV Macro
 * 
 *
 * Full Readme, source code and license agreement available on Github:
 * https://github.com/wxsd-sales/iptv-macro
 *
 ********************************************************/

class DevicePlayerControl {
        #status; // Store Status Element
        #statusTimer; // Store Status Visibility Timer
        #player; // Store Player Div Element
        #xapi; // Store JSxAPI Connection
        #panelId; // Base UI Extension Panel
        #title; // Title of video
        #video;
        #connectionAttempts = 3;

        // DevicePlayerControl constructor
        /**
         * Creates JSxAPI connect to Cisco Device using provided parameters
         * and loads video from parameter link to the provided player div
         * and outputs debugging status to the provided div element.
         * @param  {Object} parameters description
         * @param  {string} parameters.username Cisco Device Local Account Username
         * @param  {string} parameters.password Cisco Device Local Account Password
         * @param  {string} parameters.link Link to Vimeo Video
         * @param  {string} parameters.panelId Base PanelId to filter events and update widgets
         * @param  {HTMLDivElement} player [HTML Div Element for Player]
         * @param  {HTMLDivElement} status [HTML Div Element for Status Notifications]
         */
        constructor(parameters, video, status) {
          console.log("Starting Device Player Controls");

          this.status = status;
          this.video = video;
          this.panelId = parameters.panelId;

          this.setStatus("normal", `Connecting to [${parameters.ipAddress}]`);

          this.connectToDevice(parameters);

          this.playVideo(parameters.link);
        }

        /********************************************************
         * Functions for handling UI Extension Events and Update
         ********************************************************/

        connectToDevice(parameters) {
          // Make JSxAPI Connection
          jsxapi
            .connect(parameters.ipAddress, {
              username: parameters.username,
              password: parameters.password,
            })
            .on("error", (error) => {
              console.error("JSxAPI Error:", error);
              this.setStatus(
                "error",
                `Unable to connect to [${parameters.ipAddress}]`
              );

              if (error && this.connectionAttempts > 0) {
                console.log("Reconnecting");
                this.connectionAttempts = this.connectionAttempts - 1;
                setTimeout(this.connectToDevice, 300, parameters);
              }
            })
            .on("ready", async (connection) => {
              // Store xAPI connection
              this.xapi = connection;

              // Update status for debugging
              this.setStatus(
                "success",
                `Connected to [${parameters.ipAddress}]`
              );

              // Liste to Widget Events and System Volume changes
              this.xapi.Event.UserInterface.Extensions.Widget.Action.on(
                this.proccessWidgets.bind(this)
              );

              this.xapi.Event.Message.Send.on(
                this.proccessMessageEvents.bind(this)
              );
            
              if(this.player){
                const muted = this.player.muted()
                this.proccessVolumeMute(muted)
                if(muted){
                  this.proccessVolumeChange(0)
                } else {
                  const volume = this.player.volume()
                  console.log('Volume Changed: ', volume)
                  this.proccessVolumeChange(volume)
                }
              }
            });
        }

        // Process Widget Events
        async proccessWidgets(event) {
          const [panelId, category, action] = event.WidgetId.split("-");

          // Ignore Events from invalid Panels
          if (this.panelId != panelId) return;
          console.log(event);

          console.log(category);

          if (category != "playercontrols") return;

          
            switch (event.Type) {
              case "clicked":
                switch (action) {
                  case "togglemute":
                    const muted = this.player.muted();
                    this.player.muted(!muted);
                    //this.toggleVolume();
                    break;
                  case "playpause":
                    if (this.player.paused()) {
                      console.log("Playing Video");
                      this.player.play();
                      this.proccessPlayPause(false)
                    } else {
                      console.log("Pausing Video");
                      this.player.pause();
                      this.proccessPlayPause(true)
                    }
                }
                break;
              case "released":
                switch (action) {
                  case "volume":
                    const mapped = parseInt(event.Value) / 255;
                    console.log("Changing Player Volume to:", mapped);
                    this.player.volume(mapped);
                    break;
                }
                break;
            }
          
        }
        
        proccessPlayPause(state) {
          if (!this.xapi) return;
          const newState = state ? "active" : "inactive";
          console.log("Setting PlayPause Widget to:", newState);
          this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
            Value: newState,
            WidgetId: this.panelId + "-playercontrols-playpause",
          });
        }

        proccessVolumeMute(state) {
          if (!this.xapi) return;
          const newState = state ? "active" : "inactive";
          console.log("Setting Toggle Mute Widget to:", newState);
          this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
            Value: newState,
            WidgetId: this.panelId + "-playercontrols-togglemute",
          });
        }

        proccessVolumeChange(value) {
          if (!this.xapi) return;
          const mappedValue = Math.round(value*255)
          console.log("System Volume Changed to:", value);
          console.log("Setting UI Extension Volume slider to:", mappedValue);
          this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
            Value: mappedValue,
            WidgetId: this.panelId + "-playercontrols-volume",
          });
        }

        async updateTitle() {
          const title = await this.player.getVideoTitle();
          this.xapi.Command.UserInterface.Extensions.Widget.SetValue({
            Value: `Title: ` + title,
            WidgetId: this.panelId + "-title",
          });
        }

        proccessMessageEvents(value) {
          let data;
          try {
            data = JSON.parse(value.Text);
            console.log(data);
          } catch (error) {
            console.log("Error Parsing");
            return;
          }
          if (data.hasOwnProperty("link") && this.player) {
            this.player.src(data.link);
            this.player.play();
          }
        }

        /********************************************************
         * Functions for handling Player Events and Controls
         ********************************************************/

        playVideo(link) {
          console.log("Video Id", this.video, "link", link);

          this.player = videojs(
            this.video,
            {
              controls: false,
              responsive: true,
              fill: true,
              autoplay: true,
              preload: "auto",
            }
       
          );
          
          this.player.on('ready', (e)=>{
            this.player.play();
            this.player.volume(0.5);
            this.proccessVolumeChange(0)
            
          })
          
          this.player.on('volumechange', (e)=>{
            const muted = this.player.muted()
            this.proccessVolumeMute(muted)
            if(muted){
              this.proccessVolumeChange(0)
            } else {
              const volume = this.player.volume()
              console.log('Volume Changed: ', volume)
              this.proccessVolumeChange(volume)
            }
          }
          )

          this.player.src({
            src: link,
            type: "application/x-mpegURL",
          });
        }

        /********************************************************
         * Miscellaneous Functions
         ********************************************************/

        // This function updates the Connection status notifications
        // on the top right corner of the Web App for Debugging
        setStatus(type, text) {
          // Set Status Text
          this.status.innerHTML = text;

          // Set Status Background Color and make visible
          const map = { success: "green", error: "red", normal: "grey" };
          this.status.style.background = map[type] ?? "grey";
          this.status.style.visibility = "visible";

          // Clear any previous timers
          if (this.statusTimer) clearTimeout(this.statusTimer);

          // Hide Status after 2 seconds
          this.statusTimer = setTimeout(() => {
            this.status.style.visibility = "hidden";
          }, 2000);
        }

        // Converts seconds to into minutes and seconds text
        // eg. 90 seconds = 01:30
        fmtMSS(s) {
          return (s - (s %= 60)) / 60 + (9 < s ? ":" : ":0") + s;
        }

        // Maps an inputed value from source range to target range
        // Used for mapping Widget Slider 0-255 to Play Time or Volume
        mapBetween(currentNum, minAllowed, maxAllowed, min, max) {
          return Math.round(
            ((maxAllowed - minAllowed) * (currentNum - min)) / (max - min) +
              minAllowed
          );
        }
      }

      const statusDiv = document.getElementById("status");
      console.log(statusDiv);

      // If URL Hash Parameters are present, process them and connect
      if (window.location.hash) {
        // Get URL Hash Parameters
        console.log(window.location.hash);
        const hash = window.location.hash.split("#").pop();

        // Decode and parse the Parameters
        const parameters = JSON.parse(window.atob(hash));

        // Verify all required paremeters are present
        const required = [
          "username",
          "password",
          "ipAddress",
          "panelId",
          "link",
        ];
        let missing = [];
        let verified = true;
        for (let i = 0; i < required.length; i++) {
          if (required[i] in parameters) {
            console.log(
              `Hash Parameter [${required[i]}] = [${parameters[required[i]]}]`
            );
          } else {
            // If missing a parameter, don't load
            console.warn("Missing Hash Parameter:", required[i]);
            missing.push(required[i]);
            verified = false;
          }
        }

        if (verified) {
          const controller = new DevicePlayerControl(
            parameters,
            "video",
            statusDiv
          );
        } else {
          statusDiv.style.background = "red";
          statusDiv.style.visibility = "visible";
          statusDiv.innerHTML = "Missing Parameters:" + missing;
        }
      } else {
        statusDiv.style.background = "red";
        statusDiv.style.visibility = "visible";
        statusDiv.innerHTML = "Missing Hash Parameters";
      }
