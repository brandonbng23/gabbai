def header(text):
    print("__________________________________________________________________")
    print("\n               " + text)
    print("__________________________________________________________________\n")

def menu():
    header("What would you like to do?")
    print("A:\tView Readings")
    print("B:\tRegister for a Reading")
    print("C:\tAdministrator Settings")
    return input("\nEnter a letter to take an action: ")

header("Welcome to Gabbai!")
print("Gabbai is a system that allows a synagoge and its members to coordinate \n" \
"Shabbat and Yontif Torah readings in advance. This text-based interface \nis for " \
"preliminary testing. Copyright Brandon N. Goldberg 2026. \nAll rights reservered. " \
"No permission is granted to copy, modify, \nredistribute, or use this code without" \
"explicit written permission.")
action = menu()