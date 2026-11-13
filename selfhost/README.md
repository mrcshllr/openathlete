# OpenAthlete auf meiner Synology

Dieser Branch (`selfhost`, Standardbranch des Forks) baut OpenAthlete so, wie es
auf meiner eigenen Instanz läuft: das offizielle `main` von
[openathleteorg/openathlete](https://github.com/openathleteorg/openathlete) plus
die Branches aus [`patches.txt`](patches.txt).

| Was | Wo |
| --- | --- |
| Bauplan, jede Nacht | [`.github/workflows/selfhost.yml`](../.github/workflows/selfhost.yml) |
| Eigene Änderungen | [`patches.txt`](patches.txt), je eine Zeile pro Branch |
| Images | `ghcr.io/mrcshllr/openathlete-api:selfhost`, `ghcr.io/mrcshllr/openathlete-web:selfhost` |
| Dateien für das NAS | [`synology/`](synology) |

## Auf dem NAS

Einmalig, als Aufgabe im DSM-Aufgabenplaner (Benutzer `root`):

```sh
curl -fsSL https://raw.githubusercontent.com/mrcshllr/openathlete/selfhost/selfhost/synology/install.sh | sh -s /volume1/docker/openathlete
```

Danach `/volume1/docker/openathlete/.env` ausfüllen und `update.sh` ausführen.

| Skript | Zweck |
| --- | --- |
| `install.sh` | legt den Ordner an, holt die Skripte, erzeugt `.env` mit neuen Geheimnissen |
| `update.sh` | Backup, neueste Compose-Datei und Images holen, neu starten |
| `backup.sh` | Datenbank sichern (`backups/`, die letzten 14 bleiben) |
| `restore.sh` | eine Sicherung zurückspielen |
| `strava-webhook.sh` | Strava einmalig mitteilen, wohin es neue Aktivitäten meldet |

## Eigene Änderungen

Eine Änderung ist ein eigener Branch von `upstream/main` (und meist ein Pull
Request ans Hauptprojekt). Sie kommt in `patches.txt`, der nächste Build nimmt
sie mit. Lässt sie sich nicht mehr zusammenführen, schlägt der Build fehl und
nichts ändert sich auf dem NAS: Branch auf das neue `main` rebasen.

Branches mit Datenbank-Migrationen erst eintragen, wenn das Hauptprojekt dem
Ansatz zugestimmt hat. Löst es dasselbe später anders, passt meine Datenbank
nicht mehr zu seinen Migrationen.

## Lizenz

OpenAthlete steht unter der AGPL-3.0. Der Quellcode jeder Version hier ist
öffentlich: `main` von upstream plus die Branches aus `patches.txt`; jedes
Image nennt beides in seinem Label `org.opencontainers.image.description`.
