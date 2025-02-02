import BaseAccessory from './BaseAccessory';

const SCHEMA_CODE = {
  CURRENT_DOOR_STATE: ['doorcontact_state'],
  TARGET_DOOR_STATE: ['switch_1'],
  OPEN_TIME: ['open_time'],
  STAY_OPEN_TIME: ['stay_open_time'],
  AUTO_CLOSE: ['auto_close'],
};

export default class GarageDoorAccessory extends BaseAccessory {
  // Variable to store the simulated state of the door
  private simulatedDoorState?: number;
  private simulatedTargetDoorState?: number;

  requiredSchema() {
    return [SCHEMA_CODE.TARGET_DOOR_STATE];
  }

  configureServices() {
    this.configureCurrentDoorState();
    this.configureTargetDoorState();
  }

  mainService() {
    return this.accessory.getService(this.Service.GarageDoorOpener)
      || this.accessory.addService(this.Service.GarageDoorOpener);
  }

  configureCurrentDoorState() {
    const { CLOSED, STOPPED } = this.Characteristic.CurrentDoorState;
    // Initialize the simulated state to CLOSED by default
    this.simulatedDoorState = CLOSED;
    this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState)
      .onGet(() => {
        // Return the simulated state, rather than recalculating from the DP
        return this.simulatedDoorState ?? STOPPED;
      });
  }

  configureTargetDoorState() {
    const schema = this.getSchema(...SCHEMA_CODE.TARGET_DOOR_STATE);
    if (!schema) {
      return;
    }

    // Retrieve times from the device or use default values.
    let openTime = 10;       // Default open/close duration (in seconds)
    let stayOpenTime = 15;  // Default duration the door stays open (in seconds)
    let autoClose = true;  // Auto close enabled by default

    // 1. Retrieve the override for this device from the Homebridge config (deviceOverrides)
    //    The method depends on your plugin/structure. Example:
    this.log.debug('device:', JSON.stringify(this.device, null, 2));
    this.log.debug('id:', this.device.id);
    const deviceOverride = this.platform.config.options.deviceOverrides?.find(ov => ov.id === this.device.id);
    this.log.debug('deviceOverride:', JSON.stringify(deviceOverride, null, 2));
    // 2. Read open_time and stay_open_time if available
    if (deviceOverride) {
      // Note: Check if these fields are of type 'number'
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

    this.log.debug(`Open time: ${openTime} seconds`);
    this.log.debug(`Stay open time: ${stayOpenTime} seconds`);

    const { OPEN, CLOSED } = this.Characteristic.TargetDoorState;
    const { OPEN: C_OPEN, CLOSED: C_CLOSED, OPENING, CLOSING } = this.Characteristic.CurrentDoorState;

    // Initialize the target to CLOSED
    this.simulatedTargetDoorState = CLOSED;

    this.mainService().getCharacteristic(this.Characteristic.TargetDoorState)
      .onGet(() => {
        return this.simulatedTargetDoorState ?? CLOSED;
      })
      .onSet(async value => {
        if (value === OPEN) {
          this.simulatedTargetDoorState = value;
          // 1) Transition to OPENING state
          this.log.info('Starting to open (OPENING)');
          this.simulatedDoorState = OPENING;
          this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(OPENING);

          // 2) Send the open command
          await this.sendCommands([{ code: schema.code, value: true }]);
          if (autoClose) {
            // Reset remote to "close" as we simulate the door to close after stayOpenTime
            // With automatic closing door, sending a close command to the remote reopens the door
            // This is a workaround to prevent the door from reopening after stayOpenTime
            await this.delay(1000); // Wait one second to give the device time to react
            await this.sendCommands([{ code: schema.code, value: false }]);
          }
          // 3) Wait for the open time
          this.log.info('Waiting for openTime (' + openTime + ' sec) before transitioning to OPEN');
          await this.delay(openTime * 1000);

          // 4) Transition to OPEN state
          this.log.info('Transitioning to OPEN state');
          this.simulatedDoorState = C_OPEN;
          this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(C_OPEN);

          if (autoClose) {
            // 5) The door stays open for stayOpenTime seconds than onSet(CLOSED) is called
            this.log.info('The door stays open for stayOpenTime (' + stayOpenTime + ' sec)');
            await this.delay(stayOpenTime * 1000);
            this.simulatedTargetDoorState = CLOSED;
            this.mainService().getCharacteristic(this.Characteristic.TargetDoorState).updateValue(CLOSED);
          }
        } else {
          // Immediate close command
          this.simulatedDoorState = CLOSING;
          this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(CLOSING);
          await this.sendCommands([{ code: schema.code, value: false }]);
          await this.delay(openTime * 1000);
          this.simulatedDoorState = C_CLOSED;
          this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(C_CLOSED);
        }
      });
  }

  private delay(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms));
  }
}