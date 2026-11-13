import { ScrollView } from "react-native";
import { router } from "expo-router";
import { AppText as Text } from "../components/ui/primitives";
import { Button, PageShell, cs } from "../components/circular/shared";
export default function Help() {
  return (
    <PageShell back title="Help">
      <ScrollView contentContainerStyle={cs.content}>
        <Text style={cs.heading}>Applying for government jobs</Text>
        <Text style={cs.body}>
          Read the official circular and follow the department’s instructions.
          Prepare a separate Z83 for each post and quote its reference.
          FirstJobly records your confirmation; the department receives and
          processes your application.
        </Text>
        <Text style={cs.heading}>Your documents</Text>
        <Text style={cs.body}>
          Create your CV and fill the official Z83 under Career tools. Check
          every field and attach all the documents requested in the advert.
        </Text>
        <Button
          label="Career tools"
          secondary
          onPress={() => router.push("/tools")}
        />
        <Text style={cs.heading}>Ask the Community</Text>
        <Text style={cs.body}>
          Ask other members about job searches, CVs and interviews. Keep ID
          numbers, contact details and private documents out of public posts.
        </Text>
        <Button
          label="Open Community"
          secondary
          onPress={() => router.push("/community")}
        />
      </ScrollView>
    </PageShell>
  );
}
