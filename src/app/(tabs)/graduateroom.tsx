import { SafeAreaView, StyleSheet, Text } from "react-native";
export default function GraduateRoom() {
  return <SafeAreaView style={s.page}><Text style={s.title}>GraduateRoom</Text><Text style={s.text}>Connect with South African graduates.</Text></SafeAreaView>;
}
const s=StyleSheet.create({page:{flex:1,backgroundColor:"#FAFAFA",padding:20},title:{fontSize:28,fontWeight:"800",color:"#0B1F30",marginTop:20},text:{color:"#667085",marginTop:8}});
