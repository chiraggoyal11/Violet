import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ShopScreen from '../screens/ShopScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrdersScreen from '../screens/OrdersScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ThreadScreen from '../screens/ThreadScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type {
  AuthStackParamList,
  CartStackParamList,
  MainTabParamList,
  MessagesStackParamList,
  OrdersStackParamList,
  ShopStackParamList,
} from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ShopStack = createNativeStackNavigator<ShopStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function ShopNavigator() {
  return (
    <ShopStack.Navigator>
      <ShopStack.Screen
        name="ShopHome"
        component={ShopScreen}
        options={{ headerShown: false }}
      />
      <ShopStack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Product', headerTintColor: colors.brand }}
      />
    </ShopStack.Navigator>
  );
}

function CartNavigator() {
  return (
    <CartStack.Navigator>
      <CartStack.Screen
        name="CartHome"
        component={CartScreen}
        options={{ headerShown: false }}
      />
      <CartStack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: 'Checkout', headerTintColor: colors.brand }}
      />
    </CartStack.Navigator>
  );
}

function OrdersNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="OrdersList" component={OrdersScreen} />
    </OrdersStack.Navigator>
  );
}

function MessagesNavigator() {
  return (
    <MessagesStack.Navigator>
      <MessagesStack.Screen
        name="Inbox"
        component={MessagesScreen}
        options={{ headerShown: false }}
      />
      <MessagesStack.Screen
        name="Thread"
        component={ThreadScreen}
        options={({ route }) => ({
          title: route.params.title || 'Chat',
          headerTintColor: colors.brand,
        })}
      />
    </MessagesStack.Navigator>
  );
}

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  ShopTab: 'storefront-outline',
  CartTab: 'cart-outline',
  OrdersTab: 'receipt-outline',
  MessagesTab: 'chatbubbles-outline',
  Profile: 'person-outline',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="ShopTab" component={ShopNavigator} options={{ title: 'Shop' }} />
      <Tab.Screen name="CartTab" component={CartNavigator} options={{ title: 'Cart' }} />
      <Tab.Screen name="OrdersTab" component={OrdersNavigator} options={{ title: 'Orders' }} />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesNavigator}
        options={{ title: 'Messages' }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { token, booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {token ? <MainTabs /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
