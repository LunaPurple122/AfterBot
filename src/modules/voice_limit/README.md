# voice_limit

Module de gestion temporaire des salons vocaux.

Les données de responsabilité, d'ordre d'arrivée et de limite originale sont conservées en mémoire tant que le bot tourne. Au redémarrage, le manager reconstruit les salons vocaux occupés depuis le cache Discord.

Limitation Discord : l'API ne fournit pas l'ordre réel d'arrivée après un redémarrage. La file reconstruite utilise donc l'ordre des membres renvoyé par Discord à ce moment-là.
