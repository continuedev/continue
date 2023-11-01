import os
import sys

from server.main import main

# __import__('pysqlite3')
# import sys
# sys.modules['sqlite3'] = sys.modules.pop('pysqlite3')

if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
    ca_bundle_path = os.path.join(sys._MEIPASS, "ca_bundle", "cacert.pem")
    print("Certificates at: ", ca_bundle_path)
    os.environ["SSL_CERT_FILE"] = ca_bundle_path
    os.environ["REQUESTS_CA_BUNDLE"] = ca_bundle_path

if __name__ == "__main__":
    print("Running Continue server version 0.0.350")
    main()
