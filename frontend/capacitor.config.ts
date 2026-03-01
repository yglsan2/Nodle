/**
 * Configuration Capacitor pour l’application Android (APK).
 * En production, l’app charge le frontend en local (bundle) ; l’URL du serveur
 * (établissement) se configure dans l’app via « Serveur de l’établissement ».
 */
const config = {
  appId: 'fr.nodle.app',
  appName: 'Nodle',
  webDir: 'dist',
  server: {
    // En dev : décommenter et mettre l’URL du backend pour le live reload
    // url: 'http://10.0.2.2:5173',  // émulateur Android → localhost
    // cleartext: true,
  },
};

export default config;
