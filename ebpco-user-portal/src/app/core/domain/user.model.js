export function unverifiedContact() {
    return { status: 'Unverified', method: null, verifiedAt: null };
}
export function fullName(user) {
    return [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ');
}
export function defaultNotificationPreferences() {
    return {
        applicationUpdates: true,
        paymentNotifications: true,
        permitStatusUpdates: true,
        documentReminders: true,
        systemAnnouncements: true,
        emailNotifications: true,
        smsNotifications: false,
        pushNotifications: true,
    };
}
