Dev Data can be sent from Continue to local and remote destinations.

The schemas are versioned with the following approach:

- Wherever the event is sent in the code, "all" data for all versions is sent to the log function
- Versions of the schema (v1, v2, etc) use zod pick to pick the fields that are relevant to the version
- Data is sent to each destination in the config (+ local) based on the version
