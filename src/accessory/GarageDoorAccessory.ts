import BaseAccessory from './BaseAccessory';

const SCHEMA_CODE = {
  CURRENT_DOOR_STATE: ['doorcontact_state'],
  TARGET_DOOR_STATE: ['switch_1'],
  OPEN_TIME: ['open_time'],
  STAY_OPEN_TIME: ['stay_open_time'],
  AUTO_CLOSE: ['auto_close'],
};

export default class GarageDoorAccessory extends BaseAccessory {
  // Variables to store the simulated door states
  private simulatedDoorState?: number;
  private simulatedTargetDoorState?: number;

  requiredSchema() {
    // We only require the TARGET_DOOR_STATE DP for basic operation
    return [SCHEMA_CODE.TARGET_DOOR_STATE];
  }

  configureServices() {
    this.configureCurrentDoorState();
    this.configureTargetDoorState();
  }

  mainService() {
    // Retrieve or create the GarageDoorOpener service
    return (
      this.accessory.getService(this.Service.GarageDoorOpener)
      || this.accessory.addService(this.Service.GarageDoorOpener)
    );
  }

  configureCurrentDoorState() {
    const { CLOSED, STOPPED } = this.Characteristic.CurrentDoorState;

    // Initialize the simulated current door state as CLOSED
    this.simulatedDoorState = CLOSED;

    // Expose a getter that returns our simulated state
    this.mainService()
      .getCharacteristic(this.Characteristic.CurrentDoorState)
      .onGet(() => {
        // Return the simulatedDoorState if defined, else STOPPED
        return this.simulatedDoorState ?? STOPPED;
      });
  }

  configureTargetDoorState() {
    // Fetch the DP schema for the TargetDoorState (switch_1)
    const schema = this.getSchema(...SCHEMA_CODE.TARGET_DOOR_STATE);
    if (!schema) {
      return;
    }

    // Default values for door travel times
    let openTime = 10;      // time (in seconds) to open/close the door
    let autoClose = true;   // whether the door automatically closes
    let stayOpenTime = 15;  // time (in seconds) the door remains open

    // Attempt to retrieve user overrides (if any) from config
    const deviceOverride = this.platform.config.options.deviceOverrides?.find(
      (ov) => ov.id === this.device.id,
    );
    if (deviceOverride) {
      if (typeof deviceOverride.open_time === 'number') {
        openTime = deviceOverride.open_time;
      }
      if (typeof deviceOverride.stay_open_time === 'number') {
        stayOpenTime = deviceOverride.stay_open_time;
      }
      if (typeof deviceOverride.auto_close === 'boolean') {
        autoClose = deviceOverride.auto_close;
      }
    }

    this.log.debug(
      `Configured openTime = ${openTime}s, stayOpenTime = ${stayOpenTime}s, autoClose = ${autoClose}`,
    );

    const { OPEN, CLOSED } = this.Characteristic.TargetDoorState;
    const {
      OPEN: C_OPEN,
      CLOSED: C_CLOSED,
      OPENING,
      CLOSING,
    } = this.Characteristic.CurrentDoorState;

    // Initialize the simulated target door state as CLOSED
    this.simulatedTargetDoorState = CLOSED;

    // Expose getter/setter for TargetDoorState
    this.mainService()
      .getCharacteristic(this.Characteristic.TargetDoorState)
      .onGet(() => {
        // Always return our simulated target state
        return this.simulatedTargetDoorState ?? CLOSED;
      })
      .onSet(async (value) => {
        if (value === OPEN) {
          // --- OPEN sequence ---
          this.simulatedTargetDoorState = OPEN;
          this.log.info('Transitioning to OPENING state');
          this.simulatedDoorState = OPENING;
          this.mainService()
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .updateValue(OPENING);

          // Send ON command (impulse for opening)
          this.log.info('Sending "ON" command to open');
          await this.sendCommands([{ code: schema.code, value: true }]);
          if (autoClose) {
            await this.delay(1000);
            this.log.info('Turning command OFF to end the impulse');
          }
          await this.sendCommands([{ code: schema.code, value: false }]);

          // Wait for the door travel time
          this.log.info(`Waiting openTime (${openTime}s) before considering the door OPEN`);
          await this.delay(openTime * 1000);

          // Door is OPEN
          this.log.info('Door is now OPEN');
          this.simulatedDoorState = C_OPEN;
          this.mainService()
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .updateValue(C_OPEN);

          if (autoClose) {
            // --- AUTO-CLOSE sequence ---
            this.log.info(`Door will stay open for ${stayOpenTime}s`);
            await this.delay(stayOpenTime * 1000);

            this.log.info('Auto-closing the door (simulated)');
            this.simulatedDoorState = CLOSING;
            this.mainService()
              .getCharacteristic(this.Characteristic.CurrentDoorState)
              .updateValue(CLOSING);

            // Wait again for the closing travel time
            this.log.info(`Waiting another ${openTime}s to fully close`);
            await this.delay(openTime * 1000);

            // Door is CLOSED
            this.log.info('Door is now CLOSED (auto-close complete)');
            this.simulatedDoorState = C_CLOSED;
            this.mainService()
              .getCharacteristic(this.Characteristic.CurrentDoorState)
              .updateValue(C_CLOSED);
          }
        } else {
          // --- CLOSE command (user requested immediate closure) ---
          this.simulatedTargetDoorState = CLOSED;
          this.log.info('Transitioning to CLOSING state immediately');
          this.simulatedDoorState = CLOSING;
          this.mainService()
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .updateValue(CLOSING);

          this.log.info('Sending "OFF" command to close');
          await this.sendCommands([{ code: schema.code, value: false }]);

          this.log.info(`Waiting ${openTime}s for the door to finish closing`);
          await this.delay(openTime * 1000);

          this.log.info('Door is now CLOSED');
          this.simulatedDoorState = C_CLOSED;
          this.mainService()
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .updateValue(C_CLOSED);
        }
      });
  }

  /**
   * Simple helper to await a delay of `ms` milliseconds
   */
  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}