import ExpoModulesCore
import UIKit

// Public UIKit subject API. Each target decides how it handles the supplied text.
private final class ApplicationMessage: NSObject, UIActivityItemSource {
  let subject: String
  let body: String
  init(subject: String, body: String) {
    self.subject = subject
    self.body = body
  }
  func activityViewControllerPlaceholderItem(_ controller: UIActivityViewController) -> Any { body }
  func activityViewController(_ controller: UIActivityViewController, itemForActivityType type: UIActivity.ActivityType?) -> Any? { body }
  func activityViewController(_ controller: UIActivityViewController, subjectForActivityType type: UIActivity.ActivityType?) -> String { subject }
}

public final class FirstJoblyMailModule: Module {
  private var presenting = false
  public func definition() -> ModuleDefinition {
    Name("FirstJoblyMail")
    AsyncFunction("shareAsync") { (uris: [URL], subject: String, body: String, promise: Promise) in
      guard !self.presenting else {
        promise.reject("BUSY", "An application handoff is already open.")
        return
      }
      guard (2...6).contains(uris.count), uris.allSatisfy({
        $0.isFileURL && FileSystemUtilities.isReadableFile(self.appContext, $0)
      }) else {
        promise.reject("FILES_UNAVAILABLE", "Your application documents are unavailable. Prepare them again.")
        return
      }
      guard let presenter = self.appContext?.utilities?.currentViewController(),
            presenter.viewIfLoaded?.window != nil,
            !presenter.isBeingDismissed else {
        promise.reject("NO_PRESENTER", "Could not open email options. Please try again.")
        return
      }
      let message = ApplicationMessage(subject: subject, body: body)
      let items: [Any] = [message] + uris.map { $0 as Any }
      let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
      controller.excludedActivityTypes = [.assignToContact, .addToReadingList, .postToFacebook, .postToTwitter, .saveToCameraRoll, .print]
      controller.completionWithItemsHandler = { [weak self] _, completed, _, error in
        self?.presenting = false
        if let error = error {
          promise.reject("HANDOFF_FAILED", error.localizedDescription)
        } else {
          // Activity completion is NOT proof an email was sent or delivered.
          promise.resolve(completed ? "handoff" : "cancelled")
        }
      }
      if let popover = controller.popoverPresentationController {
        popover.sourceView = presenter.view
        popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
        popover.permittedArrowDirections = []
      }
      self.presenting = true
      presenter.present(controller, animated: true)
    }.runOnQueue(.main)
  }
}
