import React, { useState } from 'react';
import { User, Teacher, Permission } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import UserDetailsModal from './UserDetailsModal';

interface UserManagementProps {
    allTeachers: Teacher[];
}

const UserManagement: React.FC<UserManagementProps> = ({ allTeachers }) => {
    const { t } = useLanguage();
    const { users, setUsers, hasPermission } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editMode, setEditMode] = useState<'admin' | 'teacher' | null>(null);

    if (!hasPermission('manage_users')) {
        return <div className="text-center p-8 text-red-500">You do not have permission to access this page.</div>;
    }

    const generateUniqueCode = async (): Promise<string> => {
        setIsLoading(true);
        try {
            // FIX: Always use a named parameter `apiKey` when initializing GoogleGenAI client instance.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            const existingCodes = users.map(u => u.code);
            const prompt = `Generate a unique 4-digit numeric code that is not sequential and not in this list: [${existingCodes.join(', ')}]. Respond ONLY with the 4-digit code.`;
            
            let attempts = 0;
            while(attempts < 5) {
                // FIX: Use ai.models.generateContent to query GenAI.
                const response: GenerateContentResponse = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: prompt,
                });

                // FIX: Use response.text property to extract string output. Do not call .text().
                const text = response.text?.trim().match(/\d{4}/)?.[0]; // Extract first 4-digit number
                if (text && !existingCodes.includes(text)) {
                    setIsLoading(false);
                    return text;
                }
                attempts++;
            }
            throw new Error("AI failed to generate a unique code.");
        } catch (error) {
            console.error("Code generation failed:", error);
            // Fallback to a random generator
            let randomCode = '';
            do {
                randomCode = Math.floor(1000 + Math.random() * 9000).toString();
            } while (users.map(u => u.code).includes(randomCode));
            setIsLoading(false);
            return randomCode;
        }
    };

    const handleAddNewUser = (type: 'admin' | 'teacher') => {
        const newUser: User = {
            id: `user-new-${Date.now()}`,
            name: '',
            code: '', // Will be filled by default based on type in Modal if needed
            permissions: [],
            managedTeacherIds: []
        };
        setEditingUser(newUser);
        setEditMode(type);
    };
    
    const handleEditUser = (user: User) => {
        setEditingUser(user);
        // Determine mode based on permissions
        if (user.permissions.includes('all')) {
            setEditMode('admin');
        } else {
            setEditMode('teacher');
        }
    }
    
    const handleSaveUser = (userToSave: User) => {
        setUsers(prev => {
            const existing = prev.find(u => u.id === userToSave.id);
            if (existing) {
                return prev.map(u => u.id === userToSave.id ? userToSave : u);
            }
            const finalNewUser = { ...userToSave, id: `user-${Date.now()}`};
            return [...prev, finalNewUser];
        });
        setEditingUser(null);
        setEditMode(null);
    };

    const handleDeleteUser = (userId: string) => {
        if (window.confirm(t('confirmDelete'))) {
            setUsers(prev => prev.filter(u => u.id !== userId));
        }
    };

    // Filter users based on role for display
    const admins = users.filter(u => u.permissions.includes('all'));
    // Teachers are those who have create_self_evaluation but NOT all (to exclude admins who might have it implicitly)
    const teachers = users.filter(u => u.permissions.includes('create_self_evaluation') && !u.permissions.includes('all'));

    return (
        <div className="p-6 bg-white rounded-lg shadow-lg space-y-8">
            {editingUser && editMode && (
                <UserDetailsModal 
                    user={editingUser}
                    allTeachers={allTeachers}
                    onSave={handleSaveUser}
                    onCancel={() => { setEditingUser(null); setEditMode(null); }}
                    generateCode={generateUniqueCode}
                    isGeneratingCode={isLoading}
                    defaultPermissions={editMode === 'admin' ? ['all'] : ['create_self_evaluation']}
                    defaultCode={editMode === 'teacher' ? '1122025' : undefined}
                    lockPermissions={true} // Lock permissions based on the section
                />
            )}
            
            <h2 className="text-2xl font-bold text-center text-primary">{t('userManagement')}</h2>

            {/* Section A: Admins */}
            <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-primary">{t('adminsSection')}</h3>
                    <button onClick={() => handleAddNewUser('admin')} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-sm">
                        + {t('addAdmin')}
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">{t('adminUsersDescription')}</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {admins.map(user => (
                        <div key={user.id} className="p-3 bg-white border rounded-lg flex justify-between items-center shadow-sm">
                            <div>
                                <p className="font-bold">{user.name}</p>
                                <p className="text-sm text-gray-600 font-mono" dir="ltr">{user.code}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEditUser(user)} className="text-sm text-blue-600 hover:underline">{t('edit')}</button>
                                <button onClick={() => handleDeleteUser(user.id)} className="text-sm text-red-600 hover:underline">{t('delete')}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Section B: Teachers */}
            <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-xl font-bold text-primary">{t('teachersSection')}</h3>
                    <button onClick={() => handleAddNewUser('teacher')} className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors text-sm">
                        + {t('addTeacherUser')}
                    </button>
                </div>
                <p className="text-sm text-gray-500 mb-4">{t('teacherUsersDescription')}</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {teachers.map(user => (
                        <div key={user.id} className="p-3 bg-white border rounded-lg flex justify-between items-center shadow-sm">
                            <div>
                                <p className="font-bold">{user.name}</p>
                                <p className="text-sm text-gray-600 font-mono" dir="ltr">{user.code}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleEditUser(user)} className="text-sm text-blue-600 hover:underline">{t('edit')}</button>
                                <button onClick={() => handleDeleteUser(user.id)} className="text-sm text-red-600 hover:underline">{t('delete')}</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};


export default UserManagement;