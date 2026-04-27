import Foundation
import React

@objc(GameConfigModule)
class GameConfigModule: NSObject, RCTBridgeModule {
  static func moduleName() -> String! {
    return "GameConfigModule"
  }

  static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc
  func constantsToExport() -> [AnyHashable : Any]! {
    let activeGame = Bundle.main.object(forInfoDictionaryKey: "ACTIVE_GAME") as? String
    return [
      "ACTIVE_GAME": activeGame ?? "base-game",
    ]
  }
}

