# Discuss - NodeJs Server

This is the back-end of my Android mobile App "Discuss" written in Javascript with NodeJs.

## What it is for ?
Firstly, this server provides an API to get informations about the rooms, it's name, it's category and the number of users connected into it.
 
Secondly, as a chat app, my app needed a real-time communication between the users. This is done with Socket.io, which is the real-time engine that I'm most familiar with, it provides a communication based on events, the server can send events to the clients and the client can send events to the server as well and that is exactly what I wanted.
  
