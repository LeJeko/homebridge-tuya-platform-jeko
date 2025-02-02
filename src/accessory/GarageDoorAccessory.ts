import BaseAccessory from './BaseAccessory';

const SCHEMA_CODE = {
  TARGET_DOOR_STATE: ['switch_1'],
  OPEN_TIME: ['open_time'],
  STAY_OPEN_TIME: ['stay_open_time'],
  AUTO_CLOSE: ['auto_close'],
};

export default class GarageDoorAccessory extends BaseAccessory {
  private simulatedDoorState?: number;
  private simulatedTargetDoorState?: number;

  // A guard flag to prevent re-entering onSet while a cycle is running
  private isOperating = false;

  requiredSchema() {
    // We only really need the TARGET_DOOR_STATE
    return [SCHEMA_CODE.TARGET_DOOR_STATE];
  }

  configureServices() {
    this.configureCurrentDoorState();
    this.configureTargetDoorState();
  }

  mainService() {
    return (
      this.accessory.getService(this.Service.GarageDoorOpener)
      || this.accessory.addService(this.Service.GarageDoorOpener)
    );
  }

  configureCurrentDoorState() {
    const { CLOSED, STOPPED } = this.Characteristic.CurrentDoorState;
    // Default to CLOSED at startup
    this.simulatedDoorState = CLOSED;

    this.mainService()
      .getCharacteristic(this.Characteristic.CurrentDoorState)
      .onGet(() => {
        return this.simulatedDoorState ?? STOPPED;
      });
  }

  configureTargetDoorState() {
    const schema = this.getSchema(...SCHEMA_CODE.TARGET_DOOR_STATE);
    if (!schema) {
      return;
    }

    // Default timing
    let openTime = 10;
    let stayOpenTime = 15;
    let autoClose = true;

    // If you have user overrides in config:
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
      `openTime=${openTime}, stayOpenTime=${stayOpenTime}, autoClose=${autoClose}`,
    );

    const { OPEN, CLOSED } = this.Characteristic.TargetDoorState;
    const {
      OPEN: C_OPEN,
      CLOSED: C_CLOSED,
      OPENING,
      CLOSING,
    } = this.Characteristic.CurrentDoorState;

    // Default target is CLOSED
    this.simulatedTargetDoorState = CLOSED;

    this.mainService()
      .getCharacteristic(this.Characteristic.TargetDoorState)
      .onGet(() => {
        // Return our simulated target (not the actual DP value).
        return this.simulatedTargetDoorState ?? CLOSED;
      })
      .onSet(async (value) => {
        // If we're already operating (opening/closing), ignore new commands
        if (this.isOperating) {
          this.log.warn('Ignoring repeated onSet while door is operating');
          return;
        }

        this.isOperating = true;
        try {
          if (value === OPEN) {
            // ----- OPEN SEQUENCE -----
            this.simulatedTargetDoorState = OPEN;
            this.log.info('Request: OPEN → Set state to OPENING');
            this.simulatedDoorState = OPENING;
            this.mainService()
              .getCharacteristic(this.Characteristic.CurrentDoorState)
              .updateValue(OPENING);

            // Send "true" to open
            this.log.info('Sending ON (true) to open');
            await this.sendCommands([{ code: schema.code, value: true }]);
            if (autoClose) {
              this.log.info('Auto-closing is enabled');
              await this.delay(1000);
              this.log.info('Ending impulse -> OFF (false)');
              await this.sendCommands([{ code: schema.code, value: false }]);
            }

            // Wait openTime
            this.log.info(`Waiting ${openTime}s for OPENING to complete`);
            await this.delay(openTime * 1000);

            // Now OPEN
            this.log.info('Door is OPEN');
            this.simulatedDoorState = C_OPEN;
            this.mainService()
              .getCharacteristic(this.Characteristic.CurrentDoorState)
              .updateValue(C_OPEN);

            // If auto-close is enabled
            if (autoClose) {
              this.log.info(`Door stays open for ${stayOpenTime}s`);
              await this.delay(stayOpenTime * 1000);

              this.log.info('Auto-closing the door now (logical simulation)');
              this.simulatedTargetDoorState = CLOSED;
              this.mainService()
                .getCharacteristic(this.Characteristic.TargetDoorState)
                .updateValue(CLOSED);
              this.simulatedDoorState = CLOSING;
              this.mainService()
                .getCharacteristic(this.Characteristic.CurrentDoorState)
                .updateValue(CLOSING);

              this.log.info(`Waiting ${openTime}s for CLOSING to complete`);
              await this.delay(openTime * 1000);

              this.log.info('Door is CLOSED (auto-close done)');
              this.simulatedDoorState = C_CLOSED;
              this.mainService()
                .getCharacteristic(this.Characteristic.CurrentDoorState)
                .updateValue(C_CLOSED);

              // We won't call updateValue(CLOSED) on TargetDoorState
              // to avoid re-triggering .onSet
            }
          } else {
            // ----- CLOSE SEQUENCE -----
            this.simulatedTargetDoorState = CLOSED;
            this.log.info('Request: CLOSE → immediate CLOSING');
            this.simulatedDoorState = CLOSING;
            this.mainService()
              .getCharacteristic(this.Characteristic.CurrentDoorState)
              .updateValue(CLOSING);

            // Send "false" to close
            this.log.info('Sending OFF (false) to close');
            await this.sendCommands([{ code: schema.code, value: false }]);

            // Wait openTime
            this.log.info(`Waiting ${openTime}s for CLOSING to complete`);
            await this.delay(openTime * 1000);

            this.log.info('Door is now CLOSED');
            this.simulatedDoorState = C_CLOSED;
            this.mainService()
              .getCharacteristic(this.Characteristic.CurrentDoorState)
              .updateValue(C_CLOSED);
          }
        } finally {
          this.isOperating = false;
        }
      });
  }

  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}