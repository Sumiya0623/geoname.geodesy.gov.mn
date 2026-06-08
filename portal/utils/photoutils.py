
import os

def get_profile_photo_upload_path(instance, filename):
    new_filename = f"{instance.register}_Profile.png"
    return os.path.join('account', new_filename)