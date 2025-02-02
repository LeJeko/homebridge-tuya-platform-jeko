import BaseAccessory from './BaseAccessory';

const SCHEMA_CODE = {
  CURRENT_DOOR_STATE: ['doorcontact_state'],  // Pas obligatoire si non utilisé
  TARGET_DOOR_STATE: ['switch_1'],
  OPEN_TIME: ['open_time'],
  STAY_OPEN_TIME: ['stay_open_time'],
  AUTO_CLOSE: ['auto_close'],
};

export default class GarageDoorAccessory extends BaseAccessory {
  // These store the simulated states
  private simulatedDoorState?: number;
  private simulatedTargetDoorState?: number;

  requiredSchema() {
    // Only the TARGET_DOOR_STATE is truly required for commands
    return [SCHEMA_CODE.TARGET_DOOR_STATE];
  }

  configureServices() {
    this.configureCurrentDoorState();
    this.configureTargetDoorState();
  }

  mainService() {
    // Standard approach: get or create the "GarageDoorOpener" service
    return (
      this.accessory.getService(this.Service.GarageDoorOpener) ||
      this.accessory.addService(this.Service.GarageDoorOpener)
    );
  }

  configureCurrentDoorState() {
    // We only track a simulated state internally
    const { CLOSED, STOPPED } = this.Characteristic.CurrentDoorState;

    // By default, start in CLOSED state
    this.simulatedDoorState = CLOSED;

    // Return the simulated state whenever HomeKit asks for CurrentDoorState
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

    // Default durations
    let openTime = 10;
    let autoClose = true;
    let stayOpenTime = 15;

    // Read user overrides from config
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

    // We store the requested target state here
    this.simulatedTargetDoorState = CLOSED;

    this.mainService()
      .getCharacteristic(this.Characteristic.TargetDoorState)
      .onGet(() => {
        // Return the last known requested target
        return this.simulatedTargetDoorState ?? CLOSED;
      })
      .onSet(async (value) => {
        if (value === OPEN) {
          // Requested open
          this.simulatedTargetDoorState = OPEN;
          this.log.info('User requested OPEN → transition to OPENING');
          this.simulatedDoorState = OPENING;
          this.mainService()
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .updateValue(OPENING);

          // Send "ON" to open
          this.log.info('Sending ON (impulse) to open the door');
          await this.sendCommands([{ code: schema.code, value: true }]);

          if (autoClose) {
            // We can end the impulse if we want (esp. for push-button logic)
            await this.delay(1000);
            this.log.info('Ending the impulse → OFF');
            await this.sendCommands([{ code: schema.code, value: false }]);
          }
          // Wait for openTime
          this.log.info(`Waiting ${openTime}s to finish OPENING`);
          await this.delay(openTime * 1000);

          // Door is now OPEN
          this.log.info('Door is now OPEN');
          this.simulatedDoorState = C_OPEN;
          this.mainService()
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .updateValue(C_OPEN);

          if (autoClose) {
            // Auto-close if enabled
            this.log.info(`Door remains open for ${stayOpenTime}s`);
            await this.delay(stayOpenTime * 1000);

            this.log.info('Auto-closing the door');
            this.simulatedDoorState = CLOSING;
            this.mainService()
              .getCharacteristic(this.Characteristic.CurrentDoorState)
              .updateValue(CLOSING);

            // We skip sending ON or OFF again if you don’t want a second impulse
            // If you do want a second impulse for closure, do it here

            this.log.info(`Waiting ${openTime}s to finish CLOSING`);
            await this.delay(openTime * 1000);

            // Now CLOSED
            this.log.info('Door is now CLOSED (auto-close complete)');
            this.simulatedDoorState = C_CLOSED;
            this.mainService()
              .getCharacteristic(this.Characteristic.CurrentDoorState)
              .updateValue(C_CLOSED);
            // We do NOT set TargetDoorState to CLOSED explicitly here,
            // to avoid re-triggering onSet. That’s optional though.
          }
        } else {
          // Requested close
          this.simulatedTargetDoorState = CLOSED;
          this.log.info('User requested CLOSE → immediate CLOSING');
          this.simulatedDoorState = CLOSING;
          this.mainService()
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .updateValue(CLOSING);

          this.log.info('Sending OFF to close');
          await this.sendCommands([{ code: schema.code, value: false }]);

          this.log.info(`Waiting ${openTime}s to finish closing`);
          await this.delay(openTime * 1000);

          // Now CLOSED
          this.log.info('Door is now CLOSED');
          this.simulatedDoorState = C_CLOSED;
          this.mainService()
            .getCharacteristic(this.Characteristic.CurrentDoorState)
            .updateValue(C_CLOSED);
        }
      });
  }

  /**
   * Utility to pause for `ms` milliseconds
   */
  private delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}