import React, { Component } from 'react'
import { connect } from "react-redux";
import { withRouter, Link } from "react-router-dom";
import PropTypes from "prop-types";

import socket from "../../service/socket";

import { getUserConversation, sentMessage } from "../../actions/chatActions";
import { getUsersStatuses } from "../../actions/userActions";

import Conversations from "./Conversations/Conversations";
import Messages from "./Messages/Messages";
import Details from "./Details/Details";
import EmojiPicker from "./EmojiPicker/EmojiPicker";

import "./ChatBox.css";

class ChatBox extends Component {

    constructor() {
        super();
        this.interval = null;
        this.state = {
            text: "",
            details_clicked: false,
            sticker_clicked: false,
            show_conversations: true,
            current_user: null,
            conversation: { conversation_users: [] },
            socketConnected: false,
            socketEvent: null,
            days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            months: ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"]
        };
        this.onChange = this.onChange.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        if (!nextProps.chats.loading) {
            this.setState({ conversation: nextProps.chats.conversation });
            if (this.state.current_user) {
                this.getCurrentUserMessages(this.state.current_user['receiver_id']);
            }
        }
        if (this.props.auth.isAuthenticated && !this.state.socketConnected) {
            this.setState({ socketConnected: true, socketEvent: socket(this.props.auth.user['_id']) });
            setTimeout(() => this.socketOn(), 100);
        }
    }

    componentDidMount() {
        this.props.getUserConversation();
        this.showColumn();
        this.responseWindowResize();
        window.addEventListener('resize', this.responseWindowResize)
    }

    componentWillUnmount() {
        this.socketOff();
        this.displayNavbars();
        window.removeEventListener("resize", this.responseWindowResize);
    }

    componentDidUpdate() {
        this.showColumn();
        let messages_elements = document.getElementById('messages');
        if (messages_elements) {
            messages_elements.scrollTo(0, messages_elements.scrollHeight)
        }
    }

    socketOn() {
        // let socketEvent = socket(this.props.auth.user['_id']);
        this.state.socketEvent.on('sendMessage', this.onSendMessageSocketEventHandler);
        this.state.socketEvent.on('typing', this.onTypingSocketEventHandler);
        this.state.socketEvent.on('active', () => this.props.getUsersStatuses());
        this.state.socketEvent.on('inactive', () => this.props.getUsersStatuses());
    }

    socketOff() {
        // let socketEvent = socket(this.props.auth.user['_id']);
        this.state.socketEvent.off('sendMessage', this.onSendMessageSocketEventHandler);
    }

    onSendMessageSocketEventHandler = ({ message, new_conversation }) => {
        console.log("MESSAGE RECEIVED..");
        let current_user = { ...this.state.current_user, messages: [...this.state.current_user.messages, message] };

        let conversation;
        if (new_conversation) {
            conversation = {
                ...this.state.conversation,
                conversation_users: [...this.state.conversation.conversation_users, new_conversation],
                messages: [...this.state.conversation.messages, message]
            }
        } else {
            conversation = { ...this.state.conversation, messages: [...this.state.conversation.messages, message] };
        }

        this.setState({ current_user, conversation });
    }

    onTypingSocketEventHandler = (sender_id) => {
        if (this.state.current_user.receiver_id === sender_id) {
            let conversation_users = this.state.conversation.conversation_users;
            let index = conversation_users.findIndex(conversation_user => conversation_user.receiver_id === sender_id);
            conversation_users[index]['typing'] = true;
            this.setState({ current_user: { ...this.state.current_user, typing: true }, conversation: { ...this.state.conversation, conversation_users } });
            clearInterval(this.interval);
            let timer = 1;
            this.interval = setInterval(() => {
                timer++;
                if (timer === 5) {
                    conversation_users[index]['typing'] = false;
                    this.setState({ current_user: { ...this.state.current_user, typing: false }, conversation: { ...this.state.conversation, conversation_users } });
                    clearInterval(this.interval);
                }
            }, 200);
        }
    }

    displayNavbars() {
        let navbars = document.getElementsByTagName("nav");
        for (let i = 0; i < navbars.length; i++) {
            navbars[i].classList.remove("d-none");
        }
    }

    responseWindowResize = () => {
        this.showColumn();
        this.controlNavbars();
    }

    controlNavbars() {
        let navbars = document.getElementsByTagName("nav");
        if (document.getElementById("chatbox")) {
            if (window.innerWidth > 569) {
                this.displayNavbars();
                return;
            }
            for (let i = 0; i < navbars.length; i++) {
                navbars[i].classList.add("d-none");
            }
        }
    }

    showColumn() {
        let row1_col1 = document.querySelector("#chatbox_row1 > #chatbox_col1");
        let row2_col1 = document.querySelector("#chatbox_row2 > #chatbox_col1");
        let row1_col2 = document.querySelector("#chatbox_row1 > #chatbox_col2");
        let row2_col2 = document.querySelector("#chatbox_row2 > #chatbox_col2");

        if (window.innerWidth > 767) {
            if (row1_col1) row1_col1.style.display = "block";
            if (row2_col1) row2_col1.style.display = "block";
            if (row1_col2) row1_col2.style.display = "block";
            if (row2_col2) row2_col2.style.display = "block";
            return;
        }

        if (this.state.show_conversations) {
            if (row1_col1) row1_col1.style.display = "block";
            if (row2_col1) row2_col1.style.display = "block";
            if (row1_col2) row1_col2.style.display = "none";
            if (row2_col2) row2_col2.style.display = "none";
        } else {
            if (row1_col1) row1_col1.style.display = "none";
            if (row2_col1) row2_col1.style.display = "none";
            if (row1_col2) row1_col2.style.display = "block";
            if (row2_col2) row2_col2.style.display = "block";
        }
    }

    controlColumns = (value) => {
        this.setState({ show_conversations: true, current_user: null });
        this.showColumn();
    }

    getCurrentUserMessages(id) {
        let current_user = this.state.conversation.conversation_users.find(conversation => conversation.receiver_id === id);
        current_user['messages'] = this.state.conversation.messages.filter(
            message => {
                if (message.receiver_id === id || message.sender_id === id) {
                    return message;
                }
            }
        );
        this.setState({ current_user, show_conversations: false });
    }

    onChange(e) {
        this.state.socketEvent.emit('typing', { receiver_id: this.state.current_user.receiver_id, sender_id: this.state.conversation.user_id });
        this.setState({ text: e.target.value });
    }

    sendMessage(message, receiver_id, event) {
        event.preventDefault();
        this.props.sentMessage({ user_id: receiver_id, message: message });
        let new_message = {
            sender_id: this.props.auth.user['_id'],
            receiver_id,
            message
        }
        this.setState({
            text: "",
            current_user: {
                ...this.state.current_user,
                messages: [...this.state.current_user.messages, new_message]
            },
            conversation: {
                ...this.state.conversation,
                messages: [...this.state.conversation.messages, new_message]
            }
        });
    }

    imagePicked = (event, emojiObj) => {
        event.persist();
        this.setState({ text: this.state.text + emojiObj.emoji });
    }

    getLastSeen(lastlogoutdate, current_date) {
        let diff = current_date - new Date(lastlogoutdate);
        diff = diff / 1000;
        if (diff < 60) {
            return 'Active ' + diff.toFixed(0) + 's ago'; // seconds
        } else if (diff >= 60 && diff < 3600) {
            return 'Active ' + (diff / 60).toFixed(0) + 'm ago'; // minutes
        } else if (diff >= 3600 && diff < 86400) {
            return 'Active ' + (diff / 3600).toFixed(0) + 'h ago'; // hours
        } else if (diff >= 86400 && diff < 432000) {
            return 'Active ' + (diff / 86400).toFixed(0) + 'd ago'; // days
        } else {
            let month = this.state.months[new Date(current_date).getMonth()];
            let day = new Date(current_date).getDate();
            return 'Last seen on ' + month + ' ' + day;
        }
    }

    getUserStatus(user_id) {
        return this.props.users_statuses.find(user => user.user_id === user_id);
    }

    userActive(user_id) {
        let user = this.getUserStatus(user_id);
        if (user) {
            return user['active'];
        }
        return false;
    }

    render() {
        const { username } = this.props.auth.user;
        return (
            <div>
                <div id="chatbox" className="mt-5 pt-4 container">
                    {/* INBOX HEADERS */}
                    <div className="row bg-white border border-bottom-0 mx-5" id="chatbox_row1">
                        <div className="col-md-4 border-right p-0" id="chatbox_col1">
                            <div id="options">
                                <span></span>

                                <span id="choose_accounts" className="d-flex align-items-center">
                                    <span className="font-weight-bold mr-2">{username}</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" className="bi bi-chevron-down" viewBox="0 0 16 16">
                                        <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
                                    </svg>
                                </span>

                                <span id="new_message">
                                    <svg aria-label="New Message" className="_8-yf5 " fill="#262626" height="25" viewBox="0 0 44 44" width="25">
                                        <path d="M33.7 44.12H8.5a8.41 8.41 0 01-8.5-8.5v-25.2a8.41 8.41 0 018.5-8.5H23a1.5 1.5 0 010 3H8.5a5.45 5.45 0 00-5.5 5.5v25.2a5.45 5.45 0 005.5 5.5h25.2a5.45 5.45 0 005.5-5.5v-14.5a1.5 1.5 0 013 0v14.5a8.41 8.41 0 01-8.5 8.5z"></path>
                                        <path d="M17.5 34.82h-6.7a1.5 1.5 0 01-1.5-1.5v-6.7a1.5 1.5 0 01.44-1.06L34.1 1.26a4.45 4.45 0 016.22 0l2.5 2.5a4.45 4.45 0 010 6.22l-24.3 24.4a1.5 1.5 0 01-1.02.44zm-5.2-3h4.58l23.86-24a1.45 1.45 0 000-2l-2.5-2.5a1.45 1.45 0 00-2 0l-24 23.86z"></path>
                                        <path d="M38.2 14.02a1.51 1.51 0 01-1.1-.44l-6.56-6.56a1.5 1.5 0 012.12-2.12l6.6 6.6a1.49 1.49 0 010 2.12 1.51 1.51 0 01-1.06.4z"></path>
                                    </svg>
                                </span>
                            </div>
                        </div>

                        <div className="col-md-8 p-0" id="chatbox_col2">
                            {this.state.current_user && <div id="options">

                                {/* GO BACK ICON */}
                                {!this.state.details_clicked && <span id="back_to_conversations" onClick={() => this.controlColumns(true)}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="currentColor" className="bi bi-arrow-left-short" viewBox="0 0 16 16">
                                        <path fillRule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z" />
                                    </svg>
                                </span>}

                                {!this.state.details_clicked
                                    ? (<div id="username" className="d-flex align-items-center">
                                        <img
                                            src="https://www.clipartkey.com/mpngs/m/152-1520367_user-profile-default-image-png-clipart-png-download.png"
                                            className="rounded-circle mr-2"
                                            width="30"
                                            height="30"
                                            alt=""
                                        />

                                        <OnlineDot show={this.userActive(this.state.current_user.receiver_id)} />

                                        <span className="d-flex flex-column mt-2">
                                            <label className="font-weight-bold mb-0">{this.state.current_user.receiver_name}</label>
                                            <label className="text-muted" style={{ fontSize: '11px' }}>{
                                                this.userActive(this.state.current_user.receiver_id) ? "Active Now" : this.getLastSeen(this.getUserStatus(this.state.current_user.receiver_id)['date'], new Date())
                                            }</label>
                                        </span>
                                    </div>)
                                    :
                                    (<div id="username" className="d-flex align-items-center"></div>)}

                                {this.state.details_clicked && <span className="d-block font-weight-bold text-center">Details</span>}

                                <span id="details" onClick={() => this.setState({ details_clicked: !this.state.details_clicked })}>
                                    {!this.state.details_clicked && <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" className="bi bi-info-circle" viewBox="0 0 16 16">
                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                        <path d="M8.93 6.588l-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                                    </svg>}

                                    {this.state.details_clicked && <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" className="bi bi-info-circle-fill" viewBox="0 0 16 16">
                                        <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412l-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
                                    </svg>}
                                </span>
                            </div>}
                        </div>
                    </div>

                    <div className="row bg-white border border-top-0 mx-5" id="chatbox_row2">
                        {/* CONVERSATIONS */}
                        <div className="col-md-4 border-right p-0 h-100" id="chatbox_col1" style={{ overflowY: "scroll" }}>
                            <div id="conversation_search">
                                <input
                                    type="search"
                                    id="conversation_search_input"
                                    className="form-control"
                                    placeholder="Search"
                                />
                            </div>
                            <div id="conversations_block">
                                <Conversations
                                    loading_conversations={this.props.chats.loading}
                                    conversations={this.state.conversation.conversation_users}
                                    getCurrentUser={(id) => this.getCurrentUserMessages(id)}
                                    userActive={(user_id) => this.userActive(user_id)}
                                    getLastSeen={(user_id) => this.getLastSeen(this.getUserStatus(user_id)['date'], new Date())}
                                />
                            </div>
                        </div>

                        <EntryMessageLabel show={!this.state.current_user} />

                        <MessagesColumn
                            show={!this.state.details_clicked && this.state.current_user}
                            state={this.state}
                            onCloseEmojiSticker={() => this.setState({ sticker_clicked: false })}
                            onEmojiPickedUp={() => this.imagePicked}
                            onClickEmoji={() => this.setState({ sticker_clicked: !this.state.sticker_clicked })}
                            onChangeText={(e) => this.onChange(e)}
                            onSendMessage={(text, receiver_id, event) => this.sendMessage(text, receiver_id, event)}
                        />

                        <ChatDetails show={this.state.details_clicked} />
                    </div>
                </div>
            </div>
        )
    }
}

const ChatDetails = ({ show }) => {
    if (!show) {
        return null;
    }

    return (
        <div className="col-md-8 h-100 mx-0 px-0" id="chatbox_col2">
            <Details />
        </div>
    )
}

const EmojiStickers = ({ show, onEmojiPicked }) => {
    if (!show) {
        return null;
    }
    return (
        <div id="emoji_picker">
            <EmojiPicker pickImage={onEmojiPicked} />
        </div>
    );
}

const EntryMessageLabel = ({ show }) => {
    if (!show) {
        return null;
    }
    return (
        <div className="col-md-8 p-5 h-100" id="chatbox_col2">
            <div>
                <div className="w-100 d-block d-flex justify-content-center">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="120" height="120"
                        fill="currentColor"
                        className="bi bi-inbox"
                        viewBox="0 0 16 16"
                    >
                        <path d="M4.98 4a.5.5 0 0 0-.39.188L1.54 8H6a.5.5 0 0 1 .5.5 1.5 1.5 0 1 0 3 0A.5.5 0 0 1 10 8h4.46l-3.05-3.812A.5.5 0 0 0 11.02 4H4.98zm9.954 5H10.45a2.5 2.5 0 0 1-4.9 0H1.066l.32 2.562a.5.5 0 0 0 .497.438h12.234a.5.5 0 0 0 .496-.438L14.933 9zM3.809 3.563A1.5 1.5 0 0 1 4.981 3h6.038a1.5 1.5 0 0 1 1.172.563l3.7 4.625a.5.5 0 0 1 .105.374l-.39 3.124A1.5 1.5 0 0 1 14.117 13H1.883a1.5 1.5 0 0 1-1.489-1.314l-.39-3.124a.5.5 0 0 1 .106-.374l3.7-4.625z" />
                    </svg>
                </div>
                <div className="w-100 d-block d-flex justify-content-center">
                    <span className="h4">Your Messages</span>
                </div>
                <div className="w-100 d-block d-flex justify-content-center">
                    <span className="h6">Send private photos and messages to a friend or group.</span>
                </div>

                <div className="w-100 d-block d-flex justify-content-center mt-3">
                    <button type="button" className="btn btn-primary btn-sm">Send Message</button>
                </div>
            </div>
        </div>
    )
}

const ViewProfile = ({ conversation }) => {
    return (
        <div className="w-100 mt-3" id="view_profile">
            <div className="d-flex justify-content-center" id="view_profile_img">
                <img
                    src="https://www.clipartkey.com/mpngs/m/152-1520367_user-profile-default-image-png-clipart-png-download.png"
                    alt=""
                    width="116"
                    height="100"
                    className="rounded-circle"
                />
            </div>
            <div className="d-flex justify-content-center mt-2" id="view_profile_username">
                <span className="font-weight-bold">{conversation.receiver_name}</span>
            </div>
            <div className="d-flex justify-content-center mt-2" id="view_profile_insta">
                <span>{conversation.receiver_name}</span><span className="mx-1">&middot;</span><span>Instagaram</span>
            </div>
            <div className="d-flex justify-content-center mt-2" id="view_profile_followers">
                <span>{conversation.followers} followers</span><span className="mx-1">&middot;</span><span>{conversation.posts} posts</span>
            </div>
            <div className="d-flex justify-content-center mt-2" id="view_profile_text">
                <span>You have followed this instagram account since 2021</span>
            </div>
            <div className="d-flex justify-content-center mt-2" id="view_profile_button">
                <Link to={`profile/${conversation.receiver_username}`}>
                    <button type="button" className="btn btn-sm btn-outline-dark">View Profile</button>
                </Link>
            </div>
        </div>
    )
}

const MessagesColumn = ({ show, state, onCloseEmojiSticker, onEmojiPickedUp, onClickEmoji, onChangeText, onSendMessage }) => {
    if (!show) {
        return null;
    }

    return (
        <div className="col-md-8 p-3 h-100" id="chatbox_col2">


            {/* MESSAGES */}
            <div id="messages" onClick={onCloseEmojiSticker}>
                <ViewProfile conversation={state.current_user} />
                <Messages current_user={state.current_user} text={state.text} />
            </div>


            {/* EmojiPicker */}
            <EmojiStickers
                show={state.sticker_clicked}
                onEmojiPicked={onEmojiPickedUp}
            />

            {/* MESSAGE INPUT */}
            <div id="message_box">
                <span onClick={onClickEmoji}>
                    {!state.sticker_clicked ? (<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" className="bi bi-sticky" viewBox="0 0 16 16">
                        <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h6.086a1.5 1.5 0 0 0 1.06-.44l4.915-4.914A1.5 1.5 0 0 0 15 8.586V2.5A1.5 1.5 0 0 0 13.5 1h-11zM2 2.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V8H9.5A1.5 1.5 0 0 0 8 9.5V14H2.5a.5.5 0 0 1-.5-.5v-11zm7 11.293V9.5a.5.5 0 0 1 .5-.5h4.293L9 13.793z" />
                    </svg>) : (<svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" className="bi bi-sticky-fill" viewBox="0 0 16 16">
                        <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h6.086a1.5 1.5 0 0 0 1.06-.44l4.915-4.914A1.5 1.5 0 0 0 15 8.586V2.5A1.5 1.5 0 0 0 13.5 1h-11zm6 8.5a1 1 0 0 1 1-1h4.396a.25.25 0 0 1 .177.427l-5.146 5.146a.25.25 0 0 1-.427-.177V9.5z" />
                    </svg>)}
                </span>

                <textarea
                    className="form-control"
                    placeholder="Message..."
                    onChange={onChangeText}
                    value={state.text}
                    onKeyPress={
                        event => event.key === 'Enter' && !event.shiftKey
                            ? onSendMessage(state.text, state.current_user.receiver_id, event)
                            : null
                    }
                />

                {!state.text && <span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" className="bi bi-image" viewBox="0 0 16 16">
                        <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z" />
                        <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z" />
                    </svg>
                </span>}

                {!state.text && <span className="ml-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" fill="currentColor" className="bi bi-heart" viewBox="0 0 16 16">
                        <path d="M8 2.748l-.717-.737C5.6.281 2.514.878 1.4 3.053c-.523 1.023-.641 2.5.314 4.385.92 1.815 2.834 3.989 6.286 6.357 3.452-2.368 5.365-4.542 6.286-6.357.955-1.886.838-3.362.314-4.385C13.486.878 10.4.28 8.717 2.01L8 2.748zM8 15C-7.333 4.868 3.279-3.04 7.824 1.143c.06.055.119.112.176.171a3.12 3.12 0 0 1 .176-.17C12.72-3.042 23.333 4.867 8 15z" />
                    </svg>
                </span>}

                {state.text && <span className="text-primary" style={{ cursor: "pointer" }} onClick={(event) => onSendMessage(state.text, state.current_user.receiver_id, event)}>Send</span>}
            </div>
        </div>
    )
}

const OnlineDot = ({ show }) => {
    if (!show) {
        return null;
    }
    return (
        <div id="online_dot" />
    )
}

ChatBox.propTypes = {
    auth: PropTypes.object.isRequired,
    chats: PropTypes.object.isRequired,
    users_statuses: PropTypes.array.isRequired,
    getUserConversation: PropTypes.func.isRequired,
    sentMessage: PropTypes.func.isRequired,
    getUsersStatuses: PropTypes.func.isRequired
}

const mapStateToProps = state => ({
    auth: state.auth,
    chats: state.chats,
    users_statuses: state.users.users_statuses
});

export default connect(mapStateToProps, { getUserConversation, sentMessage, getUsersStatuses })(withRouter(ChatBox));
