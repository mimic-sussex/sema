# Interface

We are about to go through the top level areas of interaction in the Sema.

## Navigation ##

At the top of the screen, you have a set of links which enable you to navigate within Sema.
* **Playground** – explore live coding languages and machine learning in free-form ways
* **Tutorial** – this screen, the tutorial!
* **Documentation** - reference documentation for the default language, API references and useful code snippets. 
* **About** - about page, get to know more about the project.
**Admin** - Only visible if you are logged in and will appear with your username. Here you can edit your profile and manage your projects.

**Login/Signout** - Takes you to the login page, or signs you out of your account.

or, to open external resources in a new tab:
* [**Community**](https://forum.toplap.org/c/communities/sema) – the Sema community on TopLap – come and say hi!

* [**Discord**](https://discord.com/invite/nNZMJfUHrS) - join the community on Discord.

* [**Github**](https://github.com/mimic-sussex/sema) – where you can find Sema's repository and contribute to its code base.

# Dashboard
Within the playground, the area where widgets such as the live code editor appear is called the dashboard. Here you can arrange widgets however you wish.

All widgets share a few common interactions.
- You can drag and position the widget in a grid layout using the widget title bar.
- Close widgets and remove them from the dashboard by clicking the X symbol in the top right hand corner of the widget window.
- Resize a widget from the bottom right hand corner.

**Within the tutorial widgets are fixed** this is done to display the most important information for each tutorial for you.

# Settings
At the top of the playground underneath the navigation bar is where the settings are located. These are broken down into three collapsible sub sections that contain settings and options relevant to each category.

<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-eye" viewBox="0 0 20 20">
    <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
    <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    <path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
</svg>

##  Screen settings.
- Hide or show the sidebar.
- Hide or show the navigation bar.
- Enter or leave fullscreen mode.

<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-cloud" viewBox="0 0 20 20">
<path d="M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383zm.653.757c-.757.653-1.153 1.44-1.153 2.056v.448l-.445.049C2.064 6.805 1 7.952 1 9.318 1 10.785 2.23 12 3.781 12h8.906C13.98 12 15 10.988 15 9.773c0-1.216-1.02-2.228-2.313-2.228h-.5v-.5C12.188 4.825 10.328 3 8 3a4.53 4.53 0 0 0-2.941 1.1z"/>
<path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
</svg>

## Project Settings
- Make a new project.
- Clear the dashboard (closes all open windows).
- Download the project as a .json file to your computer.
- Upload a project file.
- Fork the active project.
- Share the active project.

Note that some of these options, such as forking and making a new project require you to be **logged in**. This is because projects are saved to your account.

**Project settings are not shown in the tutorial** as they are not ascociated with any user account.

<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="bi bi-speaker" viewBox="0 0 20 20">
    <path d="M12 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8zM4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4z"/>
    <path d="M8 4.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5zM8 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-3.5 1.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    <path d="M3 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>
</svg>

## Sound engine settings
Here you can view and adjust the state of the audio engine. Blue indicates that the engine is running. Red indicates that is off, and white that it has been paused.
- Turn the engine on and off.
- Turn the output volume down.
- Turn the output volume up.

# Sidebar
To the left hand side of the screen in the playground is the sidebar. From here you can launch various widgets and manage connected devices.

<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-plus-lg" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M8 2a.5.5 0 0 1 .5.5v5h5a.5.5 0 0 1 0 1h-5v5a.5.5 0 0 1-1 0v-5h-5a.5.5 0 0 1 0-1h5v-5A.5.5 0 0 1 8 2Z"/>
</svg>

 - Launch live code editor with different languages.

<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-braces" viewBox="0 0 16 16">
<path d="M2.114 8.063V7.9c1.005-.102 1.497-.615 1.497-1.6V4.503c0-1.094.39-1.538 1.354-1.538h.273V2h-.376C3.25 2 2.49 2.759 2.49 4.352v1.524c0 1.094-.376 1.456-1.49 1.456v1.299c1.114 0 1.49.362 1.49 1.456v1.524c0 1.593.759 2.352 2.372 2.352h.376v-.964h-.273c-.964 0-1.354-.444-1.354-1.538V9.663c0-.984-.492-1.497-1.497-1.6zM13.886 7.9v.163c-1.005.103-1.497.616-1.497 1.6v1.798c0 1.094-.39 1.538-1.354 1.538h-.273v.964h.376c1.613 0 2.372-.759 2.372-2.352v-1.524c0-1.094.376-1.456 1.49-1.456V7.332c-1.114 0-1.49-.362-1.49-1.456V4.352C13.51 2.759 12.75 2 11.138 2h-.376v.964h.273c.964 0 1.354.444 1.354 1.538V6.3c0 .984.492 1.497 1.497 1.6z"/>
</svg> 

- Launch a Javascript editor. Multiple example presets are shown in the dropdown menu.

<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-nut" viewBox="0 0 16 16">
    <path d="m11.42 2 3.428 6-3.428 6H4.58L1.152 8 4.58 2h6.84zM4.58 1a1 1 0 0 0-.868.504l-3.428 6a1 1 0 0 0 0 .992l3.428 6A1 1 0 0 0 4.58 15h6.84a1 1 0 0 0 .868-.504l3.429-6a1 1 0 0 0 0-.992l-3.429-6A1 1 0 0 0 11.42 1H4.58z"/>
    <path d="M6.848 5.933a2.5 2.5 0 1 0 2.5 4.33 2.5 2.5 0 0 0-2.5-4.33zm-1.78 3.915a3.5 3.5 0 1 1 6.061-3.5 3.5 3.5 0 0 1-6.062 3.5z"/>
</svg>

- Launch a debugger widget.

<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-activity" viewBox="0 0 16 16">
    <path fill-rule="evenodd" d="M6 2a.5.5 0 0 1 .47.33L10 12.036l1.53-4.208A.5.5 0 0 1 12 7.5h3.5a.5.5 0 0 1 0 1h-3.15l-1.88 5.17a.5.5 0 0 1-.94 0L6 3.964 4.47 8.171A.5.5 0 0 1 4 8.5H.5a.5.5 0 0 1 0-1h3.15l1.88-5.17A.5.5 0 0 1 6 2Z"/>
</svg>

- Launch an audio analyser

<svg  version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    x="0px" y="0px"
    viewBox="5 0 512 512"
    width=16
    height=16
    fill='currentColor'
    xml:space="preserve">
<g>
    <path d="M409.6,0v34.1H221.9c-14.1,0-25.6,11.5-25.6,25.6v42.7h-33.5c-52.2,0.1-94.5,42.3-94.5,94.5v170.6
    c0,79.6,64.8,144.5,144.5,144.5h1.2c79.6,0,144.5-64.8,144.5-144.5V196.9c-0.1-52.2-42.3-94.5-94.5-94.5h-33.5V68.3h187.7
    c14.1,0,25.6-11.5,25.6-25.6V0L409.6,0z M162.8,136.5h33.5v93.9h-93.9v-33.5C102.4,163.6,129.5,136.6,162.8,136.5z M213.9,477.9
    h-1.2c-60.9-0.1-110.3-49.4-110.3-110.3v-103h221.9v103C324.2,428.4,274.8,477.8,213.9,477.9z M324.3,196.9v33.5h-93.9v-93.9h33.5
    C297.2,136.6,324.2,163.6,324.3,196.9z"/>
</g>
</svg>

- Display mouse coordinates


<svg xmlns="http://www.w3.org/2000/svg"
width="16"
height="16"
fill="currentColor"
viewBox="0 0 16 16">
<path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/>
<path d="M10 8a2 2 0 1 1-4 0V3a2 2 0 1 1 4 0v5zM8 0a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V3a3 3 0 0 0-3-3z"/>
</svg>

- Enable or disable microphone input.

**Within the tutorial, the sidebar is disabled** since widgets that are needed for the selected tutorial are launched for you. However devices such as mouse and microphone input can still be enabled from the top right of the tutorial dashboard area.

# Context bar
At the bottom of the playground is the context bar. This displays the name of the most recently focused item and its properties. 

For example if you click on a live-code editor, it will display the properties of that editor. Which for a live-code editor are line numbers and its asscociated grammar editor.

## Save Status

The context bar also displays the save status of the currently active project in the bottom right hand corner.

Possible save states:

- <ins>Login to save changes</ins> You need to login to enable saving on projects. You can still edit the project you are on, but once you reload the page your changes will be gone.

- <ins>No permission to save</ins> Means that you don't have permission to save to the project (probably because its someone elses). You can fork the project at any time by clicking the save status text or by using the fork button in the settings bar. Any changes you have made will be carried over to your new fork.

- <ins>Saving...</ins> The project is currently being saved to your account.

- <ins>Not yet saved.</ins> Changes to your project have not yet been saved. This will get automatically done for you periodically or if you try navigate away from the playground.

- <ins>Saved.</ins> All changes to your project have been saved.

**The context bar is not displayed in the tutorial**, since it is not necessary to edit or launch widget properties to complete.