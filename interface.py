"""Formats argued text as a header and prints formatted text
@param text: text to be formatted and printed"""
def header(text):
    print("__________________________________________________________________")
    print("\n               " + text)
    print("__________________________________________________________________\n")

"""Prints menu to display and record possible user actions
@returns char repersenting user action"""
def menu():
    header("What would you like to do?")
    print("A:\tView Readings")
    print("B:\tRegister for a Reading")
    print("C:\tAdministrator Settings")
    print("Q:\tQuit")
    return input("\nEnter a letter to take an action: ")

"""Collects and records user information
@var firstN: user's first name
@var lastN: user's last name
@var email: user's email
@returns user information as an array (indexed in order of collection)"""
def register():
    firstN = input("\nEnter your first name: ")
    lastN = input("\nEnter your last name: ")
    email = input("\nEnter your email: ")
    return [firstN, lastN, email]

header("Welcome to Gabbai!")
print("Gabbai is a system that allows a synagoge and its members to coordinate \n" \
"Shabbat and Yontif Torah readings in advance. This text-based interface \nis for " \
"preliminary testing. Copyright Brandon N. Goldberg 2026. \nAll rights reservered. " \
"No permission is granted to copy, modify, \nredistribute, or use this code without" \
"explicit written permission.")
action = '1'
user = []

while action:
    action = menu().lower()

    if action == 'a':
        print()
    elif action == 'b':
        user = register()
    elif action == 'c':
        print()
    elif action == 'q':
        action = ''
