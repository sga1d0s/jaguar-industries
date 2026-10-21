const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const { mkdir, writeFile } = require('node:fs/promises');
const { join } = require('node:path');
const action='android.nfc.action.TECH_DISCOVERED';
// Se usan alias para proteger SOLO la entrada NFC en Android 17, conservando
// la entrada normal y los enlaces de Jaguar. No se capturan otras tecnologías.
module.exports = function withNfcLaunch(config) {
  config=withAndroidManifest(config,config=>{
    const application=AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    const aliases=application['activity-alias']||[];
    application['activity-alias']=aliases.filter(alias=>!['.JaguarNfcLegacy','.JaguarNfc'].includes(alias.$['android:name']));
    for(const modern of [false,true]){
      application['activity-alias'].push({
        $:{'android:name':modern?'.JaguarNfc':'.JaguarNfcLegacy','android:targetActivity':'.MainActivity',
          'android:exported':'true','android:enabled':`@bool/jaguar_nfc_${modern?'modern':'legacy'}`,
          ...(modern?{'android:permission':'android.permission.DISPATCH_NFC_MESSAGE'}:{})},
        'intent-filter':[{action:[{$:{'android:name':action}}],category:[{$:{'android:name':'android.intent.category.DEFAULT'}}]}],
        'meta-data':[{$:{'android:name':action,'android:resource':'@xml/jaguar_nfc_tech'}}],
      });
    }
    return config;
  });
  return withDangerousMod(config,['android',async config=>{
    const res=join(config.modRequest.platformProjectRoot,'app/src/main/res');
    await mkdir(join(res,'xml'),{recursive:true});
    await writeFile(join(res,'xml/jaguar_nfc_tech.xml'),'<?xml version="1.0" encoding="utf-8"?>\n<resources><tech-list><tech>android.nfc.tech.NfcV</tech></tech-list></resources>\n');
    for(const modern of [false,true]){
      const directory=join(res,modern?'values-v37':'values');
      await mkdir(directory,{recursive:true});
      await writeFile(join(directory,'jaguar_nfc.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<resources><bool name="jaguar_nfc_modern">${modern}</bool><bool name="jaguar_nfc_legacy">${!modern}</bool></resources>\n`);
    }
    return config;
  }]);
};
