import BaseAccessory from './BaseAccessory';

const SCHEMA_CODE = {
  CURRENT_DOOR_STATE: ['doorcontact_state'],
  TARGET_DOOR_STATE: ['switch_1'],
  OPEN_TIME: ['open_time'],
  STAY_OPEN_TIME: ['stay_open_time'],
};

export default class GarageDoorAccessory extends BaseAccessory {
  // Variable pour stocker l'état simulé de la porte
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
    // On initialise l'état simulé à CLOSED par défaut
    this.simulatedDoorState = CLOSED;
    this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState)
      .onGet(() => {
        // Retourne l'état simulé, plutôt que de recalculer depuis les DP
        return this.simulatedDoorState ?? STOPPED;
      });
  }

  configureTargetDoorState() {
    const schema = this.getSchema(...SCHEMA_CODE.TARGET_DOOR_STATE);
    if (!schema) {
      return;
    }

    // Récupération des temps depuis le device ou utilisation des valeurs par défaut.
    let openTime = 10;       // Durée d'ouverture/fermeture par défaut (en secondes)
    let stayOpenTime = 15;  // Durée pendant laquelle la porte reste ouverte par défaut (en secondes)

    // 1. Récupérer l'override pour cet appareil à partir de la config Homebridge (deviceOverrides)
    //    La façon de faire dépend de votre plugin / structure. Exemple :
    this.log.debug('device:', JSON.stringify(this.device, null, 2));
    this.log.debug('id:', this.device.id);
    const deviceOverride = this.platform.config.options.deviceOverrides?.find(ov => ov.id === this.device.id);
    this.log.debug('deviceOverride:', JSON.stringify(deviceOverride, null, 2));
    // 2. Lire open_time et stay_open_time si disponibles
    if (deviceOverride) {
      // Attention : vérifier si ces champs sont bien de type 'number'
      if (typeof deviceOverride.open_time === 'number') {
        openTime = deviceOverride.open_time;
      }
      if (typeof deviceOverride.stay_open_time === 'number') {
        stayOpenTime = deviceOverride.stay_open_time;
      }
    }

    this.log.debug(`Open time: ${openTime} seconds`);
    this.log.debug(`Stay open time: ${stayOpenTime} seconds`);

    const { OPEN, CLOSED } = this.Characteristic.TargetDoorState;
    const { OPEN: C_OPEN, CLOSED: C_CLOSED, OPENING, CLOSING } = this.Characteristic.CurrentDoorState;

    // On initialise la cible à CLOSED
    this.simulatedTargetDoorState = CLOSED;

    this.mainService().getCharacteristic(this.Characteristic.TargetDoorState)
      .onGet(() => {
        return this.simulatedTargetDoorState ?? CLOSED;
      })
      .onSet(async value => {
        if (value === OPEN) {
          this.simulatedTargetDoorState = value;
          // 1) Passage à l'état OPENING
          this.log.info('Début de l\'ouverture (OPENING)');
          this.simulatedDoorState = OPENING;
          this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(OPENING);

          // 2) Envoi de la commande d'ouverture
          await this.sendCommands([{ code: schema.code, value: true }]);
          await this.delay(1000); // Attente d'une seconde pour laisser le temps au device de réagir
          await this.sendCommands([{ code: schema.code, value: false }]);
          // 3) Attente du temps d'ouverture
          this.log.info('Attente de openTime (' + openTime + ' sec) avant de passer à OPEN');
          await this.delay(openTime * 1000);

          // 4) Passage à l'état OPEN
          this.log.info('Passage à l\'état OPEN');
          this.simulatedDoorState = C_OPEN;
          this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(C_OPEN);

          // 5) La porte reste ouverte pendant stayOpenTime secondes
          this.log.info('La porte reste ouverte pendant stayOpenTime (' + stayOpenTime + ' sec)');
          await this.delay(stayOpenTime * 1000);

          // 6) Passage à l'état CLOSING
          this.log.info('Passage à l\'état CLOSING');
          this.simulatedTargetDoorState = CLOSED;
          this.simulatedDoorState = CLOSING;
          this.mainService().getCharacteristic(this.Characteristic.TargetDoorState).updateValue(CLOSED);
          this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(CLOSING);

          // 7) Envoi de la commande de fermeture
          // await this.sendCommands([{ code: schema.code, value: false }]);

          // 8) Attente du temps de fermeture
          this.log.info('Attente de openTime (' + openTime + ' sec) pour la fermeture');
          await this.delay(openTime * 1000);

          // 9) Passage à l'état CLOSED
          this.log.info('Passage à l\'état CLOSED');
          this.simulatedDoorState = C_CLOSED;
          this.mainService().getCharacteristic(this.Characteristic.CurrentDoorState).updateValue(C_CLOSED);
        } else {
          // Commande de fermeture immédiate
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