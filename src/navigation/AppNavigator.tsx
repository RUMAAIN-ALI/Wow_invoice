import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RootStackParamList, MainTabParamList } from './types';
import { HomeScreen } from '../screens/HomeScreen';
import { DocumentsTabScreen } from '../screens/DocumentsTabScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MoreDocumentsScreen } from '../screens/MoreDocumentsScreen';
import { CreateDocumentTypeScreen } from '../screens/CreateDocumentTypeScreen';
import { SuggestedFieldsScreen } from '../screens/SuggestedFieldsScreen';
import { SimpleTemplateEditorScreen } from '../screens/SimpleTemplateEditorScreen';
import { FormDesignerScreen } from '../screens/FormDesignerScreen';
import { FillRecordScreen } from '../screens/FillRecordScreen';
import { CreateGstInvoiceScreen } from '../screens/CreateGstInvoiceScreen';
import { PreviewRecordScreen } from '../screens/PreviewRecordScreen';
import { DocumentDashboardScreen } from '../screens/DocumentDashboardScreen';
import { RecordListScreen } from '../screens/RecordListScreen';
import { TemplatePickerScreen } from '../screens/TemplatePickerScreen';
import { StyleStudioScreen } from '../screens/StyleStudioScreen';
import { GlobalSearchScreen } from '../screens/GlobalSearchScreen';
import { CustomerHistoryScreen } from '../screens/CustomerHistoryScreen';
import { CustomerEditScreen } from '../screens/CustomerEditScreen';
import { COLORS } from '../constants';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 1,
          borderTopColor: '#E2E8F0',
          height: 80,
          paddingBottom: 16,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#EA580C',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Records"
        component={DocumentsTabScreen}
        options={{
          tabBarLabel: 'Records',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'list' : 'list-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="MoreDocuments" component={MoreDocumentsScreen} />
        <Stack.Screen name="CreateDocumentType" component={CreateDocumentTypeScreen} />
        <Stack.Screen name="SuggestedFields" component={SuggestedFieldsScreen} />
        <Stack.Screen name="SimpleTemplateEditor" component={SimpleTemplateEditorScreen} />
        <Stack.Screen name="FormDesigner" component={FormDesignerScreen} />
        <Stack.Screen name="FillRecord" component={FillRecordScreen} />
        <Stack.Screen name="CreateGstInvoice" component={CreateGstInvoiceScreen} />
        <Stack.Screen name="PreviewRecord" component={PreviewRecordScreen} />
        <Stack.Screen name="DocumentDashboard" component={DocumentDashboardScreen} />
        <Stack.Screen name="RecordList" component={RecordListScreen} />
        <Stack.Screen name="TemplatePicker" component={TemplatePickerScreen} />
        <Stack.Screen name="StyleStudio" component={StyleStudioScreen} />
        <Stack.Screen name="GlobalSearch" component={GlobalSearchScreen} />
        <Stack.Screen name="CustomerHistory" component={CustomerHistoryScreen} />
        <Stack.Screen name="CustomerEdit" component={CustomerEditScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
