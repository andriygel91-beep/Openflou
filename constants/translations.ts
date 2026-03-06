// Openflou Translations - UK/RU/EN
export type Language = 'uk' | 'ru' | 'en';

export const translations = {
  // English
  en: {
    // Auth
    authTitle: 'Openflou',
    authSubtitle: 'Decentralized Secure Messaging',
    username: 'Username',
    password: 'Password',
    signIn: 'Sign In',
    signUp: 'Create Account',
    enterUsername: 'Enter your username',
    enterPassword: 'Enter password',
    usernameRequired: 'Username is required',
    passwordRequired: 'Password is required',
    accountCreated: 'Account created successfully',
    invalidCredentials: 'Invalid username or password',
    
    // Tabs
    chats: 'Chats',
    contacts: 'Contacts',
    settings: 'Settings',
    
    // Chats
    searchChats: 'Search chats',
    newMessage: 'New Message',
    groups: 'Groups',
    channels: 'Channels',
    noChats: 'No chats yet',
    noChatsDesc: 'Start a conversation by tapping + button',
    
    // Chat
    typeMessage: 'Type a message',
    online: 'online',
    offline: 'offline',
    lastSeen: 'last seen',
    typing: 'typing...',
    photo: 'Photo',
    video: 'Video',
    file: 'File',
    
    // Contacts
    searchContacts: 'Search contacts',
    searchByUsername: 'Search by username',
    addContact: 'Add Contact',
    contactAdded: 'Contact added',
    alreadyInContacts: 'Already in contacts',
    notInContacts: 'Not in contacts',
    tryDifferentQuery: 'Try a different search',
    noContacts: 'No contacts yet',
    noContactsDesc: 'Search by username to add contacts',
    importFromContacts: 'Import from Contacts',
    phoneContacts: 'Phone Contacts',
    
    // Settings
    account: 'Account',
    appearance: 'Appearance',
    language: 'Language',
    theme: 'Theme',
    lightTheme: 'Light',
    darkTheme: 'Dark',
    notifications: 'Notifications',
    privacy: 'Privacy & Security',
    help: 'Help & Support',
    aiAssistant: 'AI Assistant',
    logout: 'Logout',
    editProfile: 'Edit Profile',
    
    // AI Assistant
    aiTitle: 'Gemini Assistant',
    aiPlaceholder: 'Ask me anything...',
    aiWelcome: 'Hello! I\'m your AI assistant. How can I help you today?',
    
    // Group/Channel
    createGroup: 'Create Group',
    createChannel: 'Create Channel',
    editGroup: 'Edit Group',
    editChannel: 'Edit Channel',
    groupName: 'Group Name',
    channelName: 'Channel Name',
    channelDescription: 'Channel Description',
    addMembers: 'Add Members',
    admin: 'Admin',
    member: 'Member',
    subscribers: 'subscribers',
    
    // Actions
    send: 'Send',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    copy: 'Copy',
    forward: 'Forward',
    reply: 'Reply',
    save: 'Save',
    
    // Messages
    messageDeleted: 'Message deleted',
    messageEdited: 'edited',
    
    // Common
    you: 'You',
    today: 'Today',
    yesterday: 'Yesterday',
    
    // Voice
    voiceMessage: 'Voice Message',
    recording: 'Recording...',
    holdToRecord: 'Hold to record',
    releaseToSend: 'Release to send',
    slideToCancel: 'Slide to cancel',
    
    // Reactions
    addReaction: 'Add reaction',
    
    // Search
    searchMessages: 'Search messages',
    searchResults: 'Search results',
    noResults: 'No results found',
    
    // Auto theme
    autoTheme: 'Auto Theme',
    followSystem: 'Follow System',
    timeOfDay: 'Time of Day',
    
    // Groups
    members: 'members',
    viewMembers: 'View Members',
    leaveGroup: 'Leave Group',
  },
  
  // Russian
  ru: {
    // Auth
    authTitle: 'Openflou',
    authSubtitle: 'Децентрализованный защищённый мессенджер',
    username: 'Имя пользователя',
    password: 'Пароль',
    signIn: 'Войти',
    signUp: 'Создать аккаунт',
    enterUsername: 'Введите имя пользователя',
    enterPassword: 'Введите пароль',
    usernameRequired: 'Требуется имя пользователя',
    passwordRequired: 'Требуется пароль',
    accountCreated: 'Аккаунт успешно создан',
    invalidCredentials: 'Неверное имя пользователя или пароль',
    
    // Tabs
    chats: 'Чаты',
    contacts: 'Контакты',
    settings: 'Настройки',
    
    // Chats
    searchChats: 'Поиск чатов',
    newMessage: 'Новое сообщение',
    groups: 'Группы',
    channels: 'Каналы',
    noChats: 'Нет чатов',
    noChatsDesc: 'Начните беседу, нажав кнопку +',
    
    // Chat
    typeMessage: 'Введите сообщение',
    online: 'в сети',
    offline: 'не в сети',
    lastSeen: 'был(а)',
    typing: 'печатает...',
    photo: 'Фото',
    video: 'Видео',
    file: 'Файл',
    
    // Contacts
    searchContacts: 'Поиск контактов',
    searchByUsername: 'Поиск по имени пользователя',
    addContact: 'Добавить контакт',
    contactAdded: 'Контакт добавлен',
    alreadyInContacts: 'Уже в контактах',
    notInContacts: 'Не в контактах',
    tryDifferentQuery: 'Попробуйте другой запрос',
    noContacts: 'Нет контактов',
    noContactsDesc: 'Найдите пользователей по имени',
    importFromContacts: 'Импорт из контактов',
    phoneContacts: 'Контакты телефона',
    
    // Settings
    account: 'Аккаунт',
    appearance: 'Оформление',
    language: 'Язык',
    theme: 'Тема',
    lightTheme: 'Светлая',
    darkTheme: 'Тёмная',
    notifications: 'Уведомления',
    privacy: 'Приватность и безопасность',
    help: 'Помощь и поддержка',
    aiAssistant: 'AI Ассистент',
    logout: 'Выйти',
    editProfile: 'Редактировать профиль',
    
    // AI Assistant
    aiTitle: 'Gemini Ассистент',
    aiPlaceholder: 'Спросите что угодно...',
    aiWelcome: 'Привет! Я ваш AI-ассистент. Чем могу помочь?',
    
    // Group/Channel
    createGroup: 'Создать группу',
    createChannel: 'Создать канал',
    editGroup: 'Редактировать группу',
    editChannel: 'Редактировать канал',
    groupName: 'Название группы',
    channelName: 'Название канала',
    channelDescription: 'Описание канала',
    addMembers: 'Добавить участников',
    admin: 'Админ',
    member: 'Участник',
    subscribers: 'подписчиков',
    
    // Actions
    send: 'Отправить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Изменить',
    copy: 'Копировать',
    forward: 'Переслать',
    reply: 'Ответить',
    save: 'Сохранить',
    
    // Messages
    messageDeleted: 'Сообщение удалено',
    messageEdited: 'изменено',
    
    // Common
    you: 'Вы',
    today: 'Сегодня',
    yesterday: 'Вчера',
    
    // Voice
    voiceMessage: 'Голосовое сообщение',
    recording: 'Запись...',
    holdToRecord: 'Удерживайте для записи',
    releaseToSend: 'Отпустите для отправки',
    slideToCancel: 'Сдвиньте для отмены',
    
    // Reactions
    addReaction: 'Добавить реакцию',
    
    // Search
    searchMessages: 'Поиск сообщений',
    searchResults: 'Результаты поиска',
    noResults: 'Ничего не найдено',
    
    // Auto theme
    autoTheme: 'Авто тема',
    followSystem: 'Как в системе',
    timeOfDay: 'По времени суток',
    
    // Groups
    members: 'участников',
    viewMembers: 'Показать участников',
    leaveGroup: 'Покинуть группу',
  },
  
  // Ukrainian
  uk: {
    // Auth
    authTitle: 'Openflou',
    authSubtitle: 'Децентралізований захищений месенджер',
    username: 'Ім\'я користувача',
    password: 'Пароль',
    signIn: 'Увійти',
    signUp: 'Створити акаунт',
    enterUsername: 'Введіть ім\'я користувача',
    enterPassword: 'Введіть пароль',
    usernameRequired: 'Потрібне ім\'я користувача',
    passwordRequired: 'Потрібен пароль',
    accountCreated: 'Акаунт успішно створено',
    invalidCredentials: 'Невірне ім\'я користувача або пароль',
    
    // Tabs
    chats: 'Чати',
    contacts: 'Контакти',
    settings: 'Налаштування',
    
    // Chats
    searchChats: 'Пошук чатів',
    newMessage: 'Нове повідомлення',
    groups: 'Групи',
    channels: 'Канали',
    noChats: 'Немає чатів',
    noChatsDesc: 'Почніть розмову, натиснувши кнопку +',
    
    // Chat
    typeMessage: 'Введіть повідомлення',
    online: 'в мережі',
    offline: 'не в мережі',
    lastSeen: 'був(ла)',
    typing: 'друкує...',
    photo: 'Фото',
    video: 'Відео',
    file: 'Файл',
    
    // Contacts
    searchContacts: 'Пошук контактів',
    searchByUsername: 'Пошук по імені користувача',
    addContact: 'Додати контакт',
    contactAdded: 'Контакт додано',
    alreadyInContacts: 'Вже у контактах',
    notInContacts: 'Не у контактах',
    tryDifferentQuery: 'Спробуйте інший запит',
    noContacts: 'Немає контактів',
    noContactsDesc: 'Знайдіть користувачів за іменем',
    importFromContacts: 'Імпорт з контактів',
    phoneContacts: 'Контакти телефону',
    
    // Settings
    account: 'Акаунт',
    appearance: 'Оформлення',
    language: 'Мова',
    theme: 'Тема',
    lightTheme: 'Світла',
    darkTheme: 'Темна',
    notifications: 'Сповіщення',
    privacy: 'Приватність та безпека',
    help: 'Допомога та підтримка',
    aiAssistant: 'AI Асистент',
    logout: 'Вийти',
    editProfile: 'Редагувати профіль',
    
    // AI Assistant
    aiTitle: 'Gemini Асистент',
    aiPlaceholder: 'Запитайте що завгодно...',
    aiWelcome: 'Привіт! Я ваш AI-асистент. Чим можу допомогти?',
    
    // Group/Channel
    createGroup: 'Створити групу',
    createChannel: 'Створити канал',
    editGroup: 'Редагувати групу',
    editChannel: 'Редагувати канал',
    groupName: 'Назва групи',
    channelName: 'Назва каналу',
    channelDescription: 'Опис каналу',
    addMembers: 'Додати учасників',
    admin: 'Адмін',
    member: 'Учасник',
    subscribers: 'підписників',
    
    // Actions
    send: 'Відправити',
    cancel: 'Скасувати',
    delete: 'Видалити',
    edit: 'Змінити',
    copy: 'Копіювати',
    forward: 'Переслати',
    reply: 'Відповісти',
    save: 'Зберегти',
    
    // Messages
    messageDeleted: 'Повідомлення видалено',
    messageEdited: 'змінено',
    
    // Common
    you: 'Ви',
    today: 'Сьогодні',
    yesterday: 'Вчора',
    
    // Voice
    voiceMessage: 'Голосове повідомлення',
    recording: 'Запис...',
    holdToRecord: 'Утримуйте для запису',
    releaseToSend: 'Відпустіть для відправки',
    slideToCancel: 'Посуньте для скасування',
    
    // Reactions
    addReaction: 'Додати реакцію',
    
    // Search
    searchMessages: 'Пошук повідомлень',
    searchResults: 'Результати пошуку',
    noResults: 'Нічого не знайдено',
    
    // Auto theme
    autoTheme: 'Авто тема',
    followSystem: 'Як у системі',
    timeOfDay: 'За часом доби',
    
    // Groups
    members: 'учасників',
    viewMembers: 'Показати учасників',
    leaveGroup: 'Покинути групу',
  },
};
